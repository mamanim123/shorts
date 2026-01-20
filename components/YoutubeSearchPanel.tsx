import React, { useState, useEffect, useRef } from 'react';
import { Search, RefreshCw, Filter, TrendingUp, Youtube, ExternalLink, Copy, Wand2, Loader2, PlayCircle, Eye, Users, Calendar, Clock } from 'lucide-react';
import { YouTubeVideo } from '../types';
import { Button } from './Button';

interface YoutubeSearchPanelProps {
    onGeneratePlanning: (title: string, channel: string, duration: string, viralScore: number, tags: string) => void;
}

export const YoutubeSearchPanel: React.FC<YoutubeSearchPanelProps> = ({ onGeneratePlanning }) => {
    // --- State ---
    const [apiKey, setApiKey] = useState(localStorage.getItem('yt_api_key_v3') || '');
    const [keyword, setKeyword] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<YouTubeVideo[]>([]);
    const [resultsByTab, setResultsByTab] = useState<Record<'all' | 'shorts' | 'longform', YouTubeVideo[]>>({
        all: [],
        shorts: [],
        longform: [],
    });
    const [error, setError] = useState<string | null>(null);
    const [currentTab, setCurrentTab] = useState<'all' | 'shorts' | 'longform'>('all');
    const [sortOrder, setSortOrder] = useState<'viewCount' | 'subCount' | 'viralScore' | 'date'>('viewCount');
    const [isDescending, setIsDescending] = useState(true);
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const [debugOpen, setDebugOpen] = useState(false);

    // Filters
    const [apiDate, setApiDate] = useState('all');
    const [apiDuration, setApiDuration] = useState('any');
    const [apiOrder, setApiOrder] = useState('relevance');
    const [maxResults, setMaxResults] = useState('50');
    const [apiRegion, setApiRegion] = useState('KR');
    const [minViewCount, setMinViewCount] = useState('0');

    // --- Effects ---
    useEffect(() => {
        // Migration: old cache -> new per-tab caches (runs once)
        const migrateLegacyCache = () => {
            const legacy = localStorage.getItem('last_search_cache');
            if (!legacy) return;
            try {
                const parsed = JSON.parse(legacy);
                const legacyResults = parsed.results || [];
                // Default to all tab
                localStorage.setItem('last_search_cache_all', JSON.stringify({
                    ...parsed,
                    results: legacyResults
                }));
                // Heuristic: split by duration
                const shorts = legacyResults.filter((r: any) => (r.durationSec ?? 0) < 240);
                const longform = legacyResults.filter((r: any) => (r.durationSec ?? 0) >= 1200);
                localStorage.setItem('last_search_cache_shorts', JSON.stringify({
                    ...parsed,
                    results: shorts
                }));
                localStorage.setItem('last_search_cache_longform', JSON.stringify({
                    ...parsed,
                    results: longform
                }));
                // Remove legacy key to avoid re-migration loops
                localStorage.removeItem('last_search_cache');
            } catch (e) {
                console.error("Legacy cache migration failed", e);
            }
        };

        migrateLegacyCache();

        // Load per-tab cache on mount
        (['all', 'shorts', 'longform'] as const).forEach((tab) => {
            const cachedData = localStorage.getItem(`last_search_cache_${tab}`);
            if (!cachedData) return;
            try {
                const parsed = JSON.parse(cachedData);
                setResultsByTab((prev) => ({ ...prev, [tab]: parsed.results || [] }));
                if (tab === 'all') {
                    setKeyword(parsed.keyword || '');
                    if (parsed.filters) {
                        setApiDate(parsed.filters.apiDate);
                        setApiDuration(parsed.filters.apiDuration);
                        setApiOrder(parsed.filters.apiOrder);
                        setMaxResults(parsed.filters.maxResults);
                        setApiRegion(parsed.filters.apiRegion);
                        setMinViewCount(parsed.filters.minViewCount || '0');
                    }
                }
            } catch (e) {
                console.error("Cache load failed", e);
            }
        });
        setResults((prev) => {
            const initial = localStorage.getItem('last_search_cache_all');
            if (initial) {
                try {
                    const parsed = JSON.parse(initial);
                    return parsed.results || prev;
                } catch { }
            }
            return prev;
        });
    }, []);

    const saveKey = () => {
        if (!apiKey.trim()) return alert("API Key를 입력하세요.");
        localStorage.setItem('yt_api_key_v3', apiKey);
        alert("API Key가 저장되었습니다.");
    };

    const clearKey = () => {
        localStorage.removeItem('yt_api_key_v3');
        setApiKey('');
    };

    // --- Helpers ---
    const getPublishedAfterRFC3339 = (option: string) => {
        if (option === 'all') return '';
        const now = new Date();
        const nowMs = now.getTime();
        switch (option) {
            case '1h': now.setHours(now.getHours() - 1); break;
            case '24h': now.setHours(now.getHours() - 24); break;
            case '7d': now.setDate(now.getDate() - 7); break;
            case '30d': now.setDate(now.getDate() - 30); break;
            case '3m': now.setMonth(now.getMonth() - 3); break;
            case '6m': now.setMonth(now.getMonth() - 6); break;
            case '1y': now.setFullYear(now.getFullYear() - 1); break;
        }
        const candidateMs = now.getTime();
        // 방어 로직: 계산된 날짜가 현재보다 미래면 필터를 비운다(서버 시간이 더 이른 경우 대비)
        if (candidateMs > nowMs) {
            return '';
        }
        return now.toISOString();
    };

    const parseDuration = (d: string) => {
        const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!m) return 0;
        return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0');
    };

    const formatDuration = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sc = s % 60;
        return h > 0
            ? `${h}:${m.toString().padStart(2, '0')}:${sc.toString().padStart(2, '0')}`
            : `${m}:${sc.toString().padStart(2, '0')}`;
    };

    const formatNum = (n: number) => {
        if (n >= 100000000) return (n / 100000000).toFixed(1) + '억';
        if (n >= 10000) return (n / 10000).toFixed(1) + '만';
        return n.toLocaleString();
    };

    const pushDebug = (msg: string) => {
        const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
        setDebugLogs((prev) => [line, ...prev].slice(0, 200));
        console.debug('[YT-DEBUG]', line);
    };

    const fetchJsonWithDebug = async (url: string, label: string) => {
        pushDebug(`${label}: ${url}`);
        const res = await fetch(url);
        if (!res.ok) {
            const text = await res.text();
            const errMsg = `${label} 실패 ${res.status} ${res.statusText} :: ${text.slice(0, 200)}`;
            pushDebug(errMsg);
            throw new Error(errMsg);
        }
        return res.json();
    };

    // --- Core Logic ---
    const fetchTrendingVideos = async (forceRefresh = false) => {
        if (!apiKey) return alert("API 키가 필요합니다.");
        pushDebug('검색 시작');
        setLoading(true);
        setError(null);
        pushDebug('트렌딩 조회 시작');

        try {
            // Check cache
            if (!forceRefresh) {
                const cached = localStorage.getItem('trending_cache');
                if (cached) {
                    const data = JSON.parse(cached);
                    const cacheAge = Date.now() - data.timestamp;
                    if (cacheAge < 3600000 && data.region === apiRegion && data.maxResults === maxResults) {
                        setResults(data.results);
                        setLoading(false);
                        return;
                    }
                }
            }

            const region = apiRegion === 'ALL' ? 'US' : apiRegion;
            const TARGET_RESULTS = parseInt(maxResults);
            let accumulatedResults: YouTubeVideo[] = [];
            let currentNextPageToken = '';
            let apiCalls = 0;
            const MAX_API_CALLS = 5;

            while (accumulatedResults.length < TARGET_RESULTS && apiCalls < MAX_API_CALLS) {
                const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&chart=mostPopular&regionCode=${region}&maxResults=50&key=${apiKey}${currentNextPageToken ? `&pageToken=${currentNextPageToken}` : ''}`;

                const videoJson = await fetchJsonWithDebug(videoUrl, '트렌딩 목록 호출');

                if (!videoJson.items?.length) break;

                const videoItems = videoJson.items;
                currentNextPageToken = videoJson.nextPageToken;
                apiCalls++;

                // Get Channel Details
                const channelIds = [...new Set(videoItems.map((i: any) => i.snippet.channelId))];
                const channelMap: Record<string, number> = {};

                for (let i = 0; i < channelIds.length; i += 50) {
                    const chunk = channelIds.slice(i, i + 50).join(',');
                    const cUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${chunk}&key=${apiKey}`;
                    const cJson = await fetchJsonWithDebug(cUrl, '채널 정보 호출');
                    if (cJson.items) {
                        cJson.items.forEach((c: any) => {
                            let subs = parseInt(c.statistics.subscriberCount || '0');
                            if (subs === 0) subs = 1;
                            channelMap[c.id] = subs;
                        });
                    }
                }

                const batchResults = videoItems.map((item: any) => {
                    const duration = parseDuration(item.contentDetails.duration);
                    const viewCount = parseInt(item.statistics.viewCount || '0');
                    const subCount = channelMap[item.snippet.channelId] || 1;
                    const viralScore = (viewCount / subCount) * 100;

                    // --- Apply Filters Here ---
                    // 1. Duration Filter
                    if (apiDuration === 'short' && duration >= 240) return null;
                    if (apiDuration === 'medium' && (duration < 240 || duration > 1200)) return null;
                    if (apiDuration === 'long' && duration <= 1200) return null;

                    // 2. View Count Filter
                    const minViews = parseInt(minViewCount);
                    if (minViews > 0 && viewCount < minViews) return null;

                    return {
                        id: item.id,
                        title: item.snippet.title,
                        channelTitle: item.snippet.channelTitle,
                        publishedAt: item.snippet.publishedAt,
                        publishedDate: item.snippet.publishedAt.substring(0, 10),
                        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium.url,
                        viewCount,
                        subCount,
                        viralScore,
                        durationSec: duration,
                        durationStr: formatDuration(duration),
                        url: `https://www.youtube.com/watch?v=${item.id}`,
                        tags: item.snippet.tags ? item.snippet.tags.join(', ') : ''
                    };
                }).filter((i: any) => i !== null) as YouTubeVideo[];

                accumulatedResults = [...accumulatedResults, ...batchResults];

                if (!currentNextPageToken) break;
            }

            if (accumulatedResults.length === 0) throw new Error("조건에 맞는 트렌드 영상을 찾을 수 없습니다.");

            localStorage.setItem('trending_cache', JSON.stringify({
                results: accumulatedResults,
                timestamp: Date.now(),
                region: apiRegion,
                maxResults: maxResults
            }));

            setResults(accumulatedResults);

        } catch (e: any) {
            console.error(e);
            setError(e.message);
            pushDebug(`오류: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchData = async (forceRefresh = false) => {
        if (!apiKey) return alert("API 키가 필요합니다.");

        // If no keyword and default filters (except region), use Trending API
        // This restores the "Trending" tab behavior which is more reliable for "no keyword"
        const isDefaultFilters = apiDate === 'all' && apiDuration === 'any' && apiOrder === 'relevance' && minViewCount === '0';
        if (!keyword.trim() && isDefaultFilters) {
            return await fetchTrendingVideos(forceRefresh);
        }

        setLoading(true);
        setError(null);

        try {
            // Check cache
            if (!forceRefresh) {
                const cachedRaw = localStorage.getItem('last_search_cache');
                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw);
                    if (cached.keyword === keyword &&
                        cached.filters.apiDate === apiDate &&
                        cached.filters.apiDuration === apiDuration &&
                        cached.filters.apiOrder === apiOrder &&
                        cached.filters.maxResults === maxResults &&
                        cached.filters.apiRegion === apiRegion &&
                        cached.filters.minViewCount === minViewCount) {
                        setResults(cached.results);
                        setLoading(false);
                        return;
                    }
                }
            }

            // 키워드가 있으면 날짜 필터는 적용하지 않는다 (잘못된 시스템 시간으로 인한 과도한 필터링 방지)
            const publishedAfter = keyword.trim() ? '' : getPublishedAfterRFC3339(apiDate);
            let finalQuery = keyword.trim();

            let regionParam = (apiRegion === 'ALL') ? '' : `&regionCode=${apiRegion}`;
            let langParam = '';
            if (apiRegion === 'KR') langParam = '&relevanceLanguage=ko';
            else if (apiRegion === 'US') langParam = '&relevanceLanguage=en';
            else if (apiRegion === 'JP') langParam = '&relevanceLanguage=ja';

            // If searching without keyword, 'relevance' order might return poor results or nothing.
            // Also, if Min View Count filter is active, 'relevance' might return videos with low views that get filtered out.
            // So we default to 'viewCount' in these cases to ensure we get results that pass the filter.
            let finalOrder = apiOrder;
            if (apiOrder === 'relevance') {
                if (!finalQuery || minViewCount !== '0') {
                    finalOrder = 'viewCount';
                }
            }

            const performSearch = async (useLangParam: boolean, overridePublishedAfter?: string) => {
                let accumulatedResults: YouTubeVideo[] = [];
                let currentNextPageToken = '';
                let apiCalls = 0;
                const MAX_API_CALLS = 5; // Safety limit to prevent quota drain
                const TARGET_RESULTS = parseInt(maxResults);

                while (accumulatedResults.length < TARGET_RESULTS && apiCalls < MAX_API_CALLS) {
                    let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&key=${apiKey}`;

                    if (finalQuery) {
                        searchUrl += `&q=${encodeURIComponent(finalQuery)}`;
                    }

                    searchUrl += regionParam;
                    if (useLangParam) searchUrl += langParam;
                    searchUrl += `&order=${finalOrder}`;
                    if (apiDuration !== 'any') searchUrl += `&videoDuration=${apiDuration}`;
                    const pa = overridePublishedAfter === undefined ? publishedAfter : overridePublishedAfter;
                    if (pa) searchUrl += `&publishedAfter=${pa}`;
                    if (currentNextPageToken) searchUrl += `&pageToken=${currentNextPageToken}`;

                    const searchJson = await fetchJsonWithDebug(searchUrl, '검색 API 호출');

                    if (!searchJson.items?.length) break;

                    const videoItems = searchJson.items;
                    currentNextPageToken = searchJson.nextPageToken;
                    apiCalls++;

                    // --- Fetch Details for Filtering ---
                    const allVideoIds = videoItems.map((i: any) => i.id.videoId);
                    const videoDetailsMap: Record<string, any> = {};

                    // Batch fetch video details
                    for (let i = 0; i < allVideoIds.length; i += 50) {
                        const chunk = allVideoIds.slice(i, i + 50).join(',');
                        const vUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${chunk}&key=${apiKey}`;
                        const vJson = await fetchJsonWithDebug(vUrl, '비디오 상세 호출');
                        if (vJson.items) vJson.items.forEach((v: any) => videoDetailsMap[v.id] = v);
                    }

                    // Batch fetch channel details
                    const channelIds = [...new Set(videoItems.map((i: any) => i.snippet.channelId))];
                    const channelMap: Record<string, number> = {};
                    for (let i = 0; i < channelIds.length; i += 50) {
                        const chunk = channelIds.slice(i, i + 50).join(',');
                        const cUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${chunk}&key=${apiKey}`;
                        const cJson = await fetchJsonWithDebug(cUrl, '채널 상세 호출');
                        if (cJson.items) {
                            cJson.items.forEach((c: any) => {
                                let subs = parseInt(c.statistics.subscriberCount || '0');
                                if (subs === 0) subs = 1;
                                channelMap[c.id] = subs;
                            });
                        }
                    }

                    // Process and Filter IMMEDIATELY
                    const batchResults = videoItems.map((item: any) => {
                        const vId = item.id.videoId;
                        const vDetail = videoDetailsMap[vId];
                        if (!vDetail) return null;

                        const durationSec = parseDuration(vDetail.contentDetails.duration);
                        const viewCount = parseInt(vDetail.statistics.viewCount || '0');

                        // --- Apply Filters Here ---
                        // 1. Duration Filter
                        if (currentTab === 'shorts' && durationSec >= 240) return null;
                        if (currentTab === 'longform' && durationSec < 1200) return null;

                        // 2. View Count Filter
                        const minViews = parseInt(minViewCount);
                        if (minViews > 0 && viewCount < minViews) return null;

                        const subCount = channelMap[item.snippet.channelId] || 1;
                        const viralScore = (viewCount / subCount) * 100;
                        const tags = vDetail.snippet.tags ? vDetail.snippet.tags.join(', ') : '';

                        return {
                            id: vId,
                            title: item.snippet.title,
                            channelTitle: item.snippet.channelTitle,
                            publishedAt: item.snippet.publishedAt,
                            publishedDate: item.snippet.publishedAt.substring(0, 10),
                            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium.url,
                            viewCount,
                            subCount,
                            viralScore,
                            durationSec,
                            durationStr: formatDuration(durationSec),
                            url: `https://www.youtube.com/watch?v=${vId}`,
                            tags
                        };
                    }).filter((i: any) => i !== null) as YouTubeVideo[];

                    accumulatedResults = [...accumulatedResults, ...batchResults];

                    if (!currentNextPageToken) break;
                }
                return accumulatedResults;
            };

            // 1st Attempt: With Language Param
            let mergedResults = await performSearch(true);
            pushDebug(`1차 결과 개수: ${mergedResults.length}`);

            // 2nd Attempt: Without Language Param (if no results)
            if (mergedResults.length === 0 && langParam) {
                console.log("No results with language param, retrying without it...");
                mergedResults = await performSearch(false);
                pushDebug(`2차 결과 개수: ${mergedResults.length}`);
            }

            // 3rd Attempt: If publishedAfter is set and results are 0, retry once without publishedAfter
            if (mergedResults.length === 0 && publishedAfter) {
                pushDebug('결과 0 → 업로드 날짜 필터 제거 후 재시도');
                mergedResults = await performSearch(false, '');
                pushDebug(`3차(날짜 제거) 결과 개수: ${mergedResults.length}`);
            }

            // 4th Attempt: Fallback to Trending (if still no results and no keyword)
            if (mergedResults.length === 0 && !finalQuery) {
                console.log("No results found, falling back to trending...");
                return await fetchTrendingVideos(forceRefresh);
            }

            if (mergedResults.length === 0) throw new Error("검색 결과가 없습니다. 필터 조건을 변경해보세요.");

            setResults(mergedResults);
            setResultsByTab((prev) => ({ ...prev, [currentTab]: mergedResults }));

            // Save cache per tab
            localStorage.setItem(`last_search_cache_${currentTab}`, JSON.stringify({
                keyword,
                filters: { apiDate, apiDuration, apiOrder, apiRegion, maxResults, minViewCount },
                currentTab,
                results: mergedResults,
                timestamp: Date.now()
            }));

        } catch (e: any) {
            console.error(e);
            setError(e.message);
            pushDebug(`오류: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    // --- Rendering Helpers ---
    const getViralBadge = (score: number) => {
        let label = "";
        let colorClass = "";

        if (score < 100) { label = "🏳️ 일반"; colorClass = "bg-slate-700 text-slate-300"; }
        else if (score < 500) { label = "🌿 우수"; colorClass = "bg-green-700 text-white"; }
        else if (score < 1000) { label = "💧 떡상"; colorClass = "bg-blue-700 text-white"; }
        else if (score < 5000) { label = "🔮 대박"; colorClass = "bg-purple-700 text-white"; }
        else if (score < 10000) { label = "🦁 초대박"; colorClass = "bg-orange-700 text-white"; }
        else { label = "👑 신의 간택"; colorClass = "bg-gradient-to-r from-red-600 to-pink-600 text-white animate-pulse shadow-lg shadow-red-500/50"; }

        return (
            <div className={`text-xs font-bold px-2 py-1 rounded text-center ${colorClass}`}>
                {label}
            </div>
        );
    };

    // Filter & Sort
    const filteredResults = results.filter(item => {
        if (currentTab === 'shorts') {
            if (item.durationSec >= 240) return false;
        }
        if (currentTab === 'longform') {
            if (item.durationSec < 1200) return false;
        }

        // View Count Filter
        const minViews = parseInt(minViewCount);
        if (minViews > 0 && item.viewCount < minViews) return false;

        return true;
    }).sort((a, b) => {
        let valA: any = a[sortOrder];
        let valB: any = b[sortOrder];

        if (sortOrder === 'date') {
            valA = new Date(a.publishedAt).getTime();
            valB = new Date(b.publishedAt).getTime();
        }

        return isDescending ? valB - valA : valA - valB;
    });

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Header & API Key */}
            <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Youtube className="w-6 h-6 text-red-600" />
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">YouTube Native Insight <span className="text-xs font-normal text-slate-500 ml-2">V3.2</span></h2>
                </div>
                <div className="flex gap-2">
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="YouTube API Key"
                        className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white w-40"
                    />
                    <Button onClick={saveKey} size="sm" variant="secondary" className="text-xs h-8">저장</Button>
                    <Button onClick={clearKey} size="sm" variant="ghost" className="text-xs h-8 text-slate-500">초기화</Button>
                </div>
            </div>

            {/* Filters */}
            <div className="p-4 bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 shrink-0 space-y-3">
                <div className="flex flex-wrap gap-2">
                    <select value={apiDate} onChange={(e) => setApiDate(e.target.value)} className="text-xs p-2 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
                        <option value="all">전체 기간</option>
                        <option value="24h">오늘 (24시간)</option>
                        <option value="7d">이번 주 (7일)</option>
                        <option value="30d">이번 달 (30일)</option>
                        <option value="3m">최근 3개월</option>
                        <option value="6m">최근 6개월</option>
                        <option value="1y">올해 (1년)</option>
                    </select>
                    <select value={apiDuration} onChange={(e) => setApiDuration(e.target.value)} className="text-xs p-2 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
                        <option value="any">전체 길이</option>
                        <option value="short">4분 미만 (Short)</option>
                        <option value="medium">4~20분 (Medium)</option>
                        <option value="long">20분 초과 (Long)</option>
                    </select>
                    <select value={minViewCount} onChange={(e) => setMinViewCount(e.target.value)} className="text-xs p-2 rounded bg-white dark:bg-slate-800 border border-green-500 text-slate-900 dark:text-white">
                        <option value="0">조회수 전체</option>
                        <option value="10000">1만회 이상</option>
                        <option value="100000">10만회 이상</option>
                        <option value="300000">30만회 이상</option>
                        <option value="500000">50만회 이상</option>
                        <option value="1000000">100만회 이상</option>
                    </select>
                    <select value={apiOrder} onChange={(e) => setApiOrder(e.target.value)} className="text-xs p-2 rounded bg-white dark:bg-slate-800 border border-purple-500 text-slate-900 dark:text-white">
                        <option value="relevance">관련성순</option>
                        <option value="viewCount">조회수순</option>
                        <option value="date">최신순</option>
                        <option value="rating">평점순</option>
                    </select>
                    <select value={maxResults} onChange={(e) => setMaxResults(e.target.value)} className="text-xs p-2 rounded bg-white dark:bg-slate-800 border border-yellow-500 text-slate-900 dark:text-white">
                        <option value="50">50개 (빠름)</option>
                        <option value="100">100개 (적당)</option>
                        <option value="200">200개 (최대)</option>
                    </select>
                    <select value={apiRegion} onChange={(e) => setApiRegion(e.target.value)} className="text-xs p-2 rounded bg-white dark:bg-slate-800 border border-blue-500 text-slate-900 dark:text-white">
                        <option value="KR">🇰🇷 한국</option>
                        <option value="US">🇺🇸 미국</option>
                        <option value="JP">🇯🇵 일본</option>
                        <option value="ALL">🌏 전세계</option>
                    </select>
                </div>

                <div className="flex gap-2">
                    <div className="flex-1 flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchData(false)}
                                placeholder="검색어 입력 (비워두면 조건 검색)"
                                className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white"
                            />
                        </div>
                    </div>
                    <Button onClick={() => fetchData(false)} isLoading={loading} className="px-6">
                        검색
                    </Button>
                    <Button onClick={() => fetchData(true)} variant="secondary" title="API를 사용하여 새로 검색">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button onClick={() => setDebugOpen(o => !o)} variant="ghost" title="API 호출 로그 보기">
                        디버그 {debugOpen ? '▲' : '▼'}
                    </Button>
                </div>
                {debugOpen && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 max-h-48 overflow-auto text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                        {debugLogs.length === 0 ? (
                            <div className="text-slate-400">로그 없음. 검색/트렌딩 실행 시 기록됩니다.</div>
                        ) : (
                            debugLogs.map((line, idx) => (
                                <div key={idx} className="font-mono">{line}</div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Results Header */}
            <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button onClick={() => { setCurrentTab('all'); setResults(resultsByTab.all); }} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${currentTab === 'all' ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                        전체 ({results.length})
                    </button>
                    <button onClick={() => { setCurrentTab('shorts'); setResults(resultsByTab.shorts); }} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${currentTab === 'shorts' ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                        쇼츠 ({results.filter(r => r.durationSec < 240).length})
                    </button>
                    <button onClick={() => { setCurrentTab('longform'); setResults(resultsByTab.longform); }} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${currentTab === 'longform' ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                        롱폼 ({results.filter(r => r.durationSec >= 1200).length})
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">정렬:</span>
                    <div className="flex gap-1">
                        {[
                            { id: 'viewCount', label: '조회수' },
                            { id: 'subCount', label: '구독자' },
                            { id: 'viralScore', label: '떡상지수' },
                            { id: 'date', label: '최신순' }
                        ].map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => setSortOrder(opt.id as any)}
                                className={`px-2 py-1 text-xs rounded transition-colors ${sortOrder === opt.id ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setIsDescending(!isDescending)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                        {isDescending ? '⬇️' : '⬆️'}
                    </button>
                </div>
            </div>

            {/* Results Grid */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-4">
                        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                        <p className="text-slate-500 dark:text-slate-400 font-medium">유튜브 데이터를 분석 중입니다...</p>
                    </div>
                ) : error ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-4 text-center">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-500">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <p className="text-red-500 font-medium">{error}</p>
                        <Button onClick={() => fetchData(true)} variant="secondary">다시 시도</Button>
                    </div>
                ) : filteredResults.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                        <Search className="w-12 h-12 mb-4 opacity-20" />
                        <p>검색 결과가 없습니다.</p>
                        {results.length > 0 && (
                            <p className="text-xs text-slate-500 mt-2">
                                (필터 조건에 의해 {results.length}개의 영상이 숨겨졌습니다. 조회수나 길이 조건을 확인해보세요.)
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredResults.map((video) => (
                            <div key={video.id} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden hover:shadow-xl hover:border-purple-500/50 transition-all duration-300 flex flex-col">
                                {/* Thumbnail */}
                                <div className="relative aspect-video cursor-pointer overflow-hidden" onClick={() => window.open(video.url, '_blank')}>
                                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                        {video.durationStr}
                                    </div>
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                        <PlayCircle className="w-10 h-10 text-white drop-shadow-lg" />
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-3 flex-1 flex flex-col gap-2">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight" title={video.title}>
                                        {video.title}
                                    </h3>

                                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                        <span className="flex items-center gap-1 truncate max-w-[60%]">
                                            <Users className="w-3 h-3" />
                                            {video.channelTitle}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {video.publishedDate}
                                        </span>
                                    </div>

                                    {/* Viral Badge */}
                                    <div className="mt-1">
                                        {getViralBadge(video.viralScore)}
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-1 mt-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded text-[11px]">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">조회수</span>
                                            <span className="font-bold text-slate-700 dark:text-slate-300">{formatNum(video.viewCount)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">구독자</span>
                                            <span className="font-bold text-slate-700 dark:text-slate-300">{formatNum(video.subCount)}</span>
                                        </div>
                                        <div className="flex justify-between col-span-2 border-t border-slate-200 dark:border-slate-700 pt-1 mt-1">
                                            <span className="text-slate-500">기여도</span>
                                            <span className="font-bold text-purple-600 dark:text-purple-400">{video.viralScore.toFixed(0)}%</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="mt-auto pt-3 flex gap-2">
                                        <button
                                            onClick={() => navigator.clipboard.writeText(video.title)}
                                            className="flex-1 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            제목 복사
                                        </button>
                                        <button
                                            onClick={() => onGeneratePlanning(video.title, video.channelTitle, video.durationStr, video.viralScore, video.tags)}
                                            className="flex-[1.5] py-1.5 text-xs font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded hover:shadow-lg hover:shadow-purple-500/30 transition-all flex items-center justify-center gap-1"
                                        >
                                            <Wand2 className="w-3 h-3" />
                                            AI 기획
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
