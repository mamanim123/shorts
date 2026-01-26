
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ImageHistoryItem, ImageMode, CheatKey, ComboTip, CheatKeyCategoryData } from '../types';
import { generateImage, editImage, generateImageWithImagen, variationsImage, LUXURY_WARDROBE, LUXURY_WARDROBE_KR, enhancePrompt, fetchAvailableModels } from '../services/geminiService';
import { getBlob, setBlob, deleteBlob } from '../services/dbService';
import { fetchDiskImageList } from '../services/diskImageList';
import { fetchImageHistory, saveImageHistory } from '../../../services/imageHistoryService';
import { comboTips, cheatKeysData, aspectRatioPromptKeys } from './ImageStudioData';
import Lightbox from '../Lightbox';
import { v4 as uuidv4 } from 'uuid';
import { Image as ImageIcon, Sparkles, Paperclip, Download, Trash2, Loader2, Wand2, RefreshCw, X, ChevronUp, ChevronDown, ShieldOff, Eye, Palmtree, Square, Info, User, Mountain, Paintbrush, LayoutTemplate, Target, Shield, Map as MapIcon, Crosshair, Camera, Library, Tent, Beer, Film, CloudRain, Hammer, Moon, Gamepad, Snowflake, ShoppingBag, Star, Sunset, Tv, Eraser, Truck, Heart, Upload, Keyboard, History as HistoryIcon, Maximize } from 'lucide-react';
import { HarmCategory, HarmBlockThreshold, GenerateContentResponse } from '@google/genai';
import { saveImageToDisk, deleteFileFromDisk } from '../services/serverService';
import ImageHistorySidebar from '../ImageHistorySidebar';
import SaveCharacterModal from '../SaveCharacterModal';
import { CharacterCollection } from '../../../types';
import { getAppStorageValue, setAppStorageValue } from '../../../services/appStorageService';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error('Failed to convert blob to base64'));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

// ... [Prompt Templates] ...
const masterPromptTemplate = `A cinematic, isometric high-angle shot of a lone figure on a war-torn city street at dusk. Clad in damaged black and red tech-armor, the character holds a rifle in a tense, defensive stance, positioned off-center to emphasize the vast, desolate urban landscape. Smoldering rubble litters the wet asphalt as acid rain falls, catching the faint, moody glow from flickering background neon signs. The entire scene is in sharp focus, rendered with hyper-realistic, intricate textures inspired by an Unreal Engine 5 and Octane Render pipeline. Dramatic lighting cuts through the gloom, highlighting rain-slicked surfaces. Presented in 8K UHD with a subtle film grain for a gritty finish, in the grounded, epic-scale style of Christopher Nolan.`;

const walterFlashPromptTemplate = `[만들고 싶은 내용], 2000s Flash animation style, vector art, bold outlines, flat colors, simple character design, comedic,`;

const closeupPromptTemplate = `A cinematic close-up portrait of [인물: a figure], [의상: wearing intricately detailed armor], [표정/감정: with a look of solemn grief, a single tear escapes and traces a path through the grime on their cheek]. Shot on Sony FX3 with a 85mm F1.2 GM lens, creating an extremely shallow depth of field with creamy bokeh that isolates the subject. Dramatic soft lighting with subtle rim lighting highlights their features. Hyper-realistic face, lifelike skin texture with detailed pores, insanely detailed, CGI & VFX. Rendered in Unreal Engine 5 and Octane Render. In the style of Denis Villeneuve.`;

const ruinCityWomanPrompt = `[대상: 전술 저항군 인물, 헝클어진 똥머리 / a tactical resistance figure, messy bun hair], [외형: 피부에 흐르는 땀, 탄탄한 근육질 팔, 건강한 체격, 모래시계형 몸매, 잘록한 허리, 여성스러운 곡선, 탄탄한 피지컬, 글래머러스한 핏, 우아한 실루엣 / glistening sweat on skin, toned muscular arms, fit physique, hourglass figure, slim waist, feminine curves, toned physique, glamorous fit, elegant silhouette], [의상: 깊게 파인 V넥 라인의 타이트한 검은색 탱크탑, 과감한 데콜테 노출, 어두운 전술 청바지, 무릎 보호대, 검은색 군화, 가죽 장갑, 전술 하네스 / tight black tank top plunging V-neckline, deep neckline, revealing decolletage, dark tactical jeans, knee pads, black military boots, leather gloves, tactical harness], [행동/자세: 소총을 가슴에 대고 자신감 있게 서서 주변을 경계함 / standing confidently holding a rifle across chest, checking surroundings], [표정/감정: 냉철함, 차가운 시선, 날카로운 집중력, 경계 태세 / stoic, cold stare, sharp focus, alert], [배경: 붐비는 디스토피아 난민 구역, 배경에 어렴풋이 보이는 거대한 브루탈리즘 콘크리트 벽, 자욱한 먼지와 짙은 안개, 희미한 산업 조명이 비추는 임시 시장 가판대, 희미한 네온 불빛이 반사되는 젖은 바닥, 억압적인 분위기 / a crowded dystopian refugee sector, massive brutalist concrete walls looming in background, atmospheric dust and thick haze, makeshift market stalls with dim industrial lighting, wet ground reflecting faint neon lights, oppressive atmosphere], [기술/렌더링: CGI & VFX, Intricate Details, Insanely Detailed, Hyper-realistic face, Lifelike skin Texture, Unreal Engine 5, Octane Render], [예술/매체: RAW-style photograph], [감독/스타일: in the raw, in the atmospheric, texture-rich style of Denis Villeneuve], [카메라/구도: Full Shot on Canon EOS C70 with Canon RF 24-70mm F2.8 L IS USM], bustling crowd in background, detailed background characters, flanked by two tactical squad members standing in the background, 3-person team formation, depth of field`;

const backgroundFocusPromptTemplate = `An extreme long shot of [인물: a tiny lone figure], [의상: clad in weathered gear], [행동/자세: standing still against the vastness], dwarfed by the environment of [배경: a breathtaking, fantastical alien jungle with giant bioluminescent flora and floating islands connected by vines]. Shot on an ARRI Alexa Mini LF with a 24mm wide-angle anamorphic lens, deep depth of field with everything in sharp focus. Volumetric lighting with crepuscular rays piercing through the strange canopy. Insanely detailed environment, High Fantasy theme, CGI, VFX, Matte Painting. Rendered in Unreal Engine 5. In the style of Denis Villeneuve.`;

const walterPhotoShootPrompt = `[대상: young woman], [외형: short dark bob-cut hair, voluptuous figure, glamorous physique, full-figured, ample curves, elegant silhouette], [의상: dark green M-65 utility jacket, black turtleneck tucked into dark jeans, Stone Island badge on sleeve], [행동/자세: leaning forward against the railing, resting both hands on the railing, gripping the railing, looking right], [표정/감정: pensive, serious gaze], [배경: background of NYC skyline at night, Statue of Liberty, One World Trade Center, bokeh city lights, deep blue night sky, water separating subject and city, metallic railing in foreground], [기술/렌더링: photorealistic, 8k, extremely sharp focus, detailed texture], [예술/매체: RAW-style photograph, Cinematic portrait], [감독/스타일: in the cold, high-contrast thriller style of David Fincher], [카메라/구도: 3/4 profile shot, Shot on RED V-Raptor 8K VV with Leica Summilux-C lenses, shallow depth of field], [조명: warm directional lighting on face, golden hour glow, cinematic contrast lighting]`;

const walterPhotoShootZippedPrompt = `[대상: young woman], [외형: short dark bob-cut hair, voluptuous figure, glamorous physique, full-figured, ample curves, elegant silhouette], [의상: fitted dark green M-65 utility jacket zipped halfway down the chest, wearing a plain tight black turtleneck underneath, jacket open at the neck, Stone Island badge on sleeve], [행동/자세: resting both hands on the railing, gripping the railing, looking right], [표정/감정: pensive, serious gaze], [배경: background of NYC skyline at night, Statue of Liberty, One World Trade Center, bokeh city lights, deep blue night sky, water separating subject and city, metallic railing in foreground], [기술/렌더링: photorealistic, 8k, extremely sharp focus, detailed texture], [예술/매체: RAW-style photograph, Cinematic portrait], [감독/스타일: in the cold, high-contrast thriller style of David Fincher], [카메라/구도: 3/4 profile shot, Shot on RED V-Raptor 8K VV with Leica Summilux-C lenses, shallow depth of field], [조명: warm directional lighting on face, golden hour glow, cinematic contrast lighting]`;

const walterPhotoShootZippedWongKarWaiPrompt = `[대상: young woman], [외형: short dark bob-cut hair, athletic and voluptuous figure, glamorous physique, ample curves, realistic model proportions, model-like elegant silhouette], [의상: dark green fitted M-65 utility jacket zipped up to the chest, wearing a black high-neck turtleneck underneath, fully covered, Stone Island badge on sleeve, slim waist fit, realistic fabric texture], [행동/자세: looking right, hands in jacket pockets, standing naturally], [표정/감정: pensive, serious gaze, melancholic], [배경: background of NYC skyline at night, Statue of Liberty, One World Trade Center, bokeh city lights, deep blue night sky, water separating subject and city, metallic railing in foreground], [기술/렌더링: photorealistic, 8k, extremely sharp focus, detailed texture], [예술/매체: RAW-style photograph, Cinematic portrait], [감독/스타일: in the moody, neon-soaked aesthetic of Wong Kar-wai], [카메라/구도: Shot on Arriflex 35BL camera with vintage Cooke Speed Panchro 75mm lens, Aspect Ratio 16:9, Cinemascope framing], [필름: Kodak Vision3 500T color negative film, heavy film grain, halation effect on neon lights], [효과: slight motion blur, step-printing effect, dreamy atmosphere], [조명: warm directional lighting on face, golden hour glow]`;

const unrealMarketPrompt = `Generate a breathtaking 8K UHD CGI and VFX masterpiece in the style of Unreal Engine 5 and Octane Render, incorporating the visual aesthetic of [감독/스타일: Fantasy RPG Game Art Style, lively and detailed].
The image is framed as a [구도/앵글: Third-Person Over-the-Shoulder Shot (Back View)], placing the viewer right behind the main character walking into the scene.
The Main Subject is [대상: a wandering adventurer or merchant (seen from behind)] wearing [의상: a worn leather backpack filled with supplies, a cloak, and travel gear].
The character is [행동/자세: walking through a crowded market street, looking at the various stalls and peddlers] interacting with the lively environment.
The background is incredibly detailed, depicting [배경: a bustling medieval marketplace with wooden stalls piled high with potions, fruits, weapons, and fabrics]. There are [군중: various NPC peddlers and customers bargaining and talking].
Use [조명: warm lantern lighting mixed with natural sunlight filtering through awnings] to create a [분위기: cozy, vibrant, and bustling] atmosphere.
The scene is captured with a [카메라/렌즈: virtual camera, 35mm lens] with a focus on the depth of the market street.
Ensure the image showcases insanely intricate details of the market items (clutter), textures of wood and fabric, and the lively interactions of the crowd.`;

const unrealTavernPrompt = `Generate a breathtaking 8K UHD CGI and VFX masterpiece in the style of Unreal Engine 5 and Octane Render, incorporating the visual aesthetic of [감독/스타일: Classic Fantasy RPG Art Style, cozy and atmospheric].
The image is framed as a [구도/앵글: Third-Person Over-the-Shoulder Shot (Back View)], placing the viewer right behind the character entering the warm interior.
The Main Subject is [대상: a tired but satisfied adventurer (seen from behind)] wearing [의상: a fur-lined cloak, leather armor, and a weapon strapped to the back].
The character is [행동/자세: standing at the entrance of a lively tavern, looking at the various stalls and peddlers] soaking in the atmosphere.
The background is incredibly detailed, depicting [배경: a bustling medieval tavern interior with heavy wooden beams, a roaring stone fireplace, and long tables filled with food].
There are [군중: rowdy dwarves, elves, and humans drinking from tankards, laughing, and a bard playing music in the corner].
Use [조명: warm amber lighting from the fireplace and candles, volumetric haze/smoke] to create a [분위기: cozy, welcoming, rowdy, and rustic] atmosphere.
The scene is captured with a [카메라/렌즈: virtual cinematic camera, 35mm lens] emphasizing the warmth and depth of the room.
Ensure the image showcases insanely intricate details of [foaming beer mugs, roasted meat on plates, candle wax dripping], and the rich texture of old wood.`;

const villeneuveDeakinsPrompt = `Create a hyper-realistic, raw photograph masterpiece, harmonizing the vision of [감독: Director Denis Villeneuve] with the visual style of [촬영: Cinematographer Roger Deakins].
The image features [대상: a sophisticated young woman] who has [외형: natural wavy brown hair, light freckles on her nose, and realistic skin texture] and is wearing [의상: a modern minimal coat with a clean silhouette over a dark turtleneck].
The subject is [행동/자세: standing confidently, looking towards a distant light source] with a [표정/감정: serious, mysterious, and determined expression].
The background depicts [배경: a vast, brutalist architectural space with massive concrete walls, geometric shadows, and a hazy atmosphere], emphasizing the scale and isolation.
This scene is shot on [카메라/렌즈: Arri Alexa LF with Arri Signature Prime lenses], creating a [필름/효과: pristine, high-contrast digital cinema look with deep blacks].
Use [조명: Deakins-style atmospheric lighting with strong silhouettes and distinct separation] to create a [분위기: epic, tense, and visually stunning] mood.
The final image must show extremely lifelike skin texture with visible pores, sharp focus on the eyes, and a shallow depth of field with bokeh, avoiding any artificial CGI smoothness.`;

const rainyCafePrompt = `Create a hyper-realistic, raw photograph masterpiece, harmonizing the moody aesthetic of [감독: Director Wong Kar-wai] with the visual clarity of [촬영: Cinematographer Roger Deakins].
The image features [대상: a beautiful young woman] who has [외형: wet, slightly messy hair, expressive eyes, and realistic skin texture] and is wearing [의상: a cozy oversized knitted sweater and a delicate necklace].
The subject is [행동/자세: sitting inside a cafe, resting her chin on her hand, and looking out of a rainy window] with a [표정/감정: melancholic, dreamy, and sentimental expression].
The background depicts [배경: a glass window covered in raindrops, with blurred colorful city neon lights and passing cars outside creating beautiful bokeh], emphasizing the separation between the cozy inside and the cold outside.
This scene is shot on [카메라/렌즈: Arri Alexa LF with vintage Cooke lenses], creating a [필름/효과: soft, cinematic look with rich colors and slight film grain].
Use [조명: cinematic street lighting reflecting on the wet glass mixed with warm indoor ambient light] to create a [분위기: romantic, nostalgic, and emotional] mood.
The final image must show extremely lifelike skin texture with visible pores, sharp focus on the eyes, and a shallow depth of field with bokeh, avoiding any artificial CGI smoothness.`;

const blacksmithWatchPrompt = `Generate a breathtaking 8K UHD CGI and VFX masterpiece in the style of Unreal Engine 5 and Octane Render, incorporating the visual aesthetic of [감독/스타일: Fantasy RPG Art Style, dynamic and intense].
The image is framed as a [구도/앵글: Medium Shot (Side Profile View)], capturing the protagonist's profile as they watch the blacksmith.
The Main Subject is [대상: a warrior or customer (seen from the side)] wearing [의상: travel gear with empty weapon sheaths].
The character is [행동/자세: standing nearby with body turned towards the blacksmith, arms crossed firmly on the chest, looking down intently at the glowing metal on the anvil].
The blacksmith is [상호작용: visible in the background or side, hammering the red-hot metal], creating a connection between the two characters.
The background is packed with details, depicting [배경: a chaotic blacksmith workshop filled with racks of swords, glowing furnaces, and flying sparks].
Use [조명: intense orange and red lighting from the fire, illuminating the character's face and front torso] to create a [분위기: energetic, hot, powerful, and industrial] atmosphere.
The scene is captured with a [카메라/렌즈: virtual cinematic camera, 50mm lens] focusing on the interaction and the gaze.
Ensure the image showcases insanely intricate details of [sweat on the blacksmith, the character's serious gaze, and flying sparks], avoiding a back-to-back pose.`;

const blacksmithSleepPrompt = `Generate a breathtaking 8K UHD CGI and VFX masterpiece in the style of Unreal Engine 5 and Octane Render, incorporating the visual aesthetic of [감독/스타일: Fantasy RPG Art Style, dynamic and humorous].
The image is framed as a [구도/앵글: Medium Shot (Focus on Foreground)], focusing sharply on the sleeping character while the background is slightly blurred.
The Main Subject is [대상: a tired warrior] wearing [외형/의상: worn travel gear, leather armor, and a heavy backpack].
The character is [행동/자세: sitting slumped heavily on a rough wooden chair, completely passed out, with head tilted back in total relaxation and arms hanging loosely].
The face shows a [표정/감정: comical deep sleep expression with mouth hanging wide open (slack-jawed), eyes shut tight, looking completely oblivious to the noise].
In the background, the Blacksmith is [배경 인물: visible but slightly blurred, working intensely, hammering red-hot metal on the anvil], creating a funny contrast.
The background depicts [배경: a chaotic workshop filled with flying sparks, glowing furnaces, and hanging weapons].
Use [조명: warm orange glow from the fire illuminating the sleeping face, contrasting with the darker corners] to create a [분위기: cozy, humorous, and realistic] atmosphere.
The scene is captured with a [카메라/렌즈: virtual cinematic camera, 50mm lens] with a shallow depth of field (bokeh) to keep the focus on the funny sleeping face.
Ensure the image showcases insanely intricate details of [the slack-jawed expression, the texture of the armor, and the dynamic sparks behind them].`;

const pixarAnimationPrompt = `Generate a breathtaking 3D animation masterpiece in the style of [스튜디오/스타일: Pixar and Disney Animation Studios, known for vibrant colors and emotional storytelling].
The image is framed as a [구도/앵글: Medium Shot or Wide Shot], capturing the charm of the character and the environment.
The Main Subject is [대상: a cute and spirited young adventurer] who has [외형: big expressive eyes, round smooth face, stylized hair with soft volume] and is wearing [의상: a colorful hooded fantasy outfit with exaggerated textures].
The character is [행동/자세: holding a glowing map, pointing excitedly towards the horizon] with a [표정/감정: joyful, surprised, and full of wonder] expression.
The background is stylized and painterly, depicting [배경: a magical forest with floating islands, oversized glowing mushrooms, and sparkling fairy dust].
Use [조명: soft cinematographic lighting, rim lighting to separate character from background, and global illumination] to create a [분위기: magical, heartwarming, and dreamy] atmosphere.
The scene is rendered with [기술/엔진: Unreal Engine 5, Cinema 4D, Redshift Render, Arnold Render], focusing on [질감: subsurface scattering (SSS) for skin, soft cloth simulation, and vibrant color grading].
The scene is captured with a [카메라/렌즈: Virtual Animation Camera, 50mm or 85mm prime lens, f/1.8], creating a soft, creamy bokeh effect in the background.`;

const winterStreetFashionPrompt = `Create a hyper-realistic, high-fashion photography masterpiece, captured in the aesthetic of [감독/스타일: Vogue Editorial or Street Snap Style, chic and sophisticated].
The image features [대상: a stunning fashion model] who has [외형: elegant makeup with rosy cheeks from the cold, long wavy hair flowing in the wind, and realistic skin texture].
She is wearing [의상: a luxurious beige cashmere coat over a white turtleneck sweater, a thick wool scarf wrapped around the neck, and stylish leather boots], perfectly styled for winter.
The subject is [행동/자세: walking confidently down the street (catwalk walk), adjusting her scarf with one hand, looking directly at the camera with a chic gaze].
The background depicts [배경: a snowy city street in winter (like NYC or Seoul), with soft snow falling, blurred city lights, and pedestrians in the distance].
Use [조명: soft natural daylight mixed with city neon lights, creating a cold yet cozy winter mood] to emphasize the textures of the clothing.
The scene is shot on [카메라/렌즈: Sony A7R IV with an 85mm f/1.4 portrait lens], creating a beautiful bokeh effect that separates the model from the busy street.
Ensure the image showcases insanely intricate details of [the fabric textures (wool, cashmere), visible breath vapor in the cold air, and the sharpness of the eyes].`;

const winterNightMoodPrompt = `Create a hyper-realistic, high-fashion photography masterpiece, captured in the aesthetic of [감독/스타일: Cinematic Movie Still, moody, sentimental, and chic].
The image is framed as a [구도/앵글: Full Body or Knee-Up Shot], capturing the model leaning against a wall.
The image features [대상: a sophisticated fashion model] wearing [액세서리: stylish eyeglasses with thin frames] reflecting the city lights.
She is wearing [의상: a long beige cashmere coat (opened), a black sweater, and fitted black leather trousers (pants) tucked into boots]. She is holding [소품: a luxury black quilted handbag (Chanel style)].
The subject is [행동/자세: leaning casually against a textured brick wall, with a classic iron streetlamp post standing on the ground right beside her].
The face shows [시선/표정: looking away to the side (profile or 3/4 view), not at the camera, with a pensive, melancholic, and emotional expression].
The background features [배경: the standing streetlamp casting a warm yellow tungsten light on her, snow falling softly in the dark night].
Use [조명: cinematic side lighting from the streetlamp, creating strong contrast and mood] to create a [분위기: lonely, intellectual, and romantic] atmosphere.
The scene is shot on [카메라/렌즈: Sony A7R IV with an 85mm lens], focusing on her glasses and the texture of the leather pants.
Ensure the image showcases insanely intricate details of [the leather texture of the pants, the reflection in the glasses, and the falling snow].`;

const winterLuxuryFashionPrompt = `Create a hyper-realistic, high-fashion photography masterpiece, captured in the aesthetic of [감독/스타일: Vogue Night Editorial, luxurious and moody].
The image features [대상: a stunning high-fashion model] who has [외형: elegant makeup with red lips, glowing skin, and long hair blowing in the wind].
She is wearing [의상: a luxurious beige cashmere coat (opened) over a chic black turtleneck, sleek black leather thigh-high boots, and holding a quilted black leather handbag with a gold chain (Chanel style)].
The subject is [행동/자세: walking confidently on a snowy street at night, looking at the camera with a chic and alluring gaze, one hand holding the bag strap].
The background depicts [배경: a blurry city street at night with falling snow, illuminated by warm streetlights and distant neon signs].
Use [조명: warm tungsten streetlights creating an amber glow (halation) on the snow, mixed with cinematic backlight] to create a [분위기: romantic, expensive, and emotional winter night] atmosphere.
The scene is shot on [카메라/렌즈: Sony A7R IV with an 85mm f/1.2 lens], creating a creamy bokeh of the yellow city lights in the background.
Ensure the image showcases insanely intricate details of [the leather texture of the boots and bag, the soft texture of the coat, and the sparkling snowflakes in the yellow light].`;

const goldenHourBeachPrompt = `Create a hyper-realistic, cinematic masterpiece, harmonizing the romantic aesthetic of [감독: Director Wong Kar-wai] with the lighting mastery of [촬영: Cinematographer Roger Deakins].
The image features [대상: a beautiful couple (man and woman)] sitting closely together on a sandy beach.
They have [외형: windblown hair, sun-kissed skin, and extremely lifelike skin texture] and are wearing [의상: (Man) a loose white linen shirt and rolled-up pants, (Woman) a soft knit cardigan over a flowy dress], looking cozy and natural.
The couple is [행동/자세: sitting side-by-side on the sand, leaning on each other's shoulders, watching the sunset] enjoying the intimate moment.
Next to them is [소품: a small crackling campfire], sending bright sparks into the air.
The background depicts [배경: a vast ocean horizon with gentle waves, wet sand reflecting the sky, and the sun setting on the water].
Use [조명: Golden Hour lighting creating a warm amber rim light on their silhouettes, mixed with the orange glow from the fire] to create a [분위기: romantic, nostalgic, sentimental, and dreamy] atmosphere.
The scene is captured with a [카메라/렌즈: Arri Alexa LF with a 50mm vintage prime lens], creating a soft bokeh on the waves.
Ensure the image showcases insanely intricate details of [the sand texture, the flying sparks, the emotional expression in their eyes, and the warm sunlight].`;

const christmasLivingRoomPrompt = `Create a hyper-realistic, wide-angle shot of a cozy modern living room at night during Christmas.
The Image features [대상/공간: a modern living room scene] where [인물: a young girl wearing a white fleece hoodie] is wrapped in a [소품: red plaid blanket], sitting on a white sofa and holding a teddy bear, watching a large wall-mounted TV screen.
In the center, [동물: a golden retriever dog] is sleeping peacefully on a grey rug.
The TV screen displays [TV 내용: a high-quality 3D animated movie in Pixar/Disney style]. The scene on the screen features [캐릭터: a cute mouse wearing a Santa hat and a striped scarf, waving] standing in a [배경: snowy landscape with majestic mountains, pine trees, a full moon, and a cozy log cabin with warm lights].
To the left, [배경/창문: a large glass sliding door reveals a snowy night outside with a lit Christmas tree], adding to the festive atmosphere.
Use [조명: warm ambient indoor lighting mixed with the glow from the TV screen] to create a [분위기: cozy, peaceful, and cinematic] mood.
The scene is captured with a [카메라/렌즈: Sony A7R IV, 24mm wide lens], ensuring sharp focus on the room details while capturing the vibrant colors on the screen.
Ensure insane details on the textures of the blanket, the dog's fur, and the 3D render quality on the TV screen.`;

const emotionalIdolBedroomPrompt = `A candid eye-level medium shot of [인물: a Asian Model, Beautiful Korean-idol aesthetic, featuring a delicate V-shaped face, large expressive eyes, and long voluminous wavy brown hair with see-through bangs] in [의상: an oversized pastel blue hoodie with long sleeves covering half of her hands, comfortable white ankle socks], [행동/자세: sitting cross-legged comfortably on the rug, tightly hugging a large fluffy white sheep plush toy, resting her chin slightly on the plushie], character positioned centrally. [배경: a cozy and lived-in bedroom, a wooden bookshelf overflowing with colorful manga books and anime figurines, artistic posters plastered on the walls, a bed with soft pastel bedding, real dust particles floating in natural light]. [표정: a look of calm serenity, gazing softly into the distance, a faint and gentle smile]. [스타일: Authentic photography, Shot on Sony A7R IV, 35mm lens, f/1.8 aperture for natural bokeh], [조명: soft natural afternoon sunlight streaming through the window, warm color palette], [디테일: high resolution, 8k, raw photo style, slight film grain, Kodak Portra 400 film look, highly detailed eyes and hair].`;


// --- Survivor Templates ---
const survivorWhiteShirtPrompt = `[대상: a hardened female survivor, athletic hourglass figure, brown ponytail], [외형: face covered in heavy sweat and grime, realistic skin texture, mud stains, intense eyes, battle scars], [의상: dirty white v-neck t-shirt, worn cargo shorts, brown leather belt with drop-leg gun holster, combat boots, bandaged arms], [행동/자세: aiming a handgun forward, dynamic action pose, muscles tensed, heavy breathing], [표정/감정: fierce determination, desperate survival instinct], [배경: ], 
8K UHD, CGI & VFX, Intricate Details, Insanely Detailed, Hyper-realistic face, Lifelike skin Texture, Unreal Engine 5, Octane Render, RAW-style photograph.`;

const survivorVehiclePrompt = `Generate a hyper-realistic CGI masterpiece in the style of [감독/스타일: Neill Blomkamp's 'District 9', found-footage sci-fi style, Hyper-realistic textures].
The image is framed as a [구도/앵글: Cinematic wide shot from a distance (Front View)], showing the object speeding directly towards the camera.
The Main Subject is [대상: a makeshift armored vehicle], which includes a character visible in the roof turret manning a heavy machine gun.
The vehicle is [행동/자세: speeding rapidly down a dirt road, tearing through the terrain, and kicking up massive clouds of dust behind it].
The background depicts [배경: a gritty, sun-bleached shantytown with a towering alien mothership hovering ominously in the sky].
Use [조명: bright cinematic lighting] to emphasize the [분위기: chaotic sense of speed, intense, and gritty] atmosphere.
The scene is captured with [카메라/렌즈: intense motion blur] to accentuate the rapid movement.
Ensure the image showcases details of [세부 묘사: the makeshift armor textures, the dust clouds, and the looming alien ship].`;

const survivorScoutCapPrompt = `[대상: a wasteland scavenger scout, young adult female], [외형: wearing a worn baseball cap, loose hair strands framing face, freckles, piercing eyes, dirty face, lip cut], [의상: worn leather jacket over a hoodie, tactical cargo pants, heavy backpack, fingerless gloves, converse sneakers], [행동/자세: crouching low, observing surroundings, holding a hunting knife, stealthy posture], [표정/감정: cautious, fearful but brave, nervous tension], [배경: ], 
8K UHD, CGI & VFX, Intricate Details, Insanely Detailed, Hyper-realistic face, Lifelike skin Texture, Unreal Engine 5, Octane Render, RAW-style photograph.`;


const DEFAULT_PROMPT_TEMPLATE = `[대상: ], [외형: ], [의상: ], [행동/자세: ], [표정/감정: ],
8K UHD, CGI & VFX, Intricate Details, Insanely Detailed, Hyper-realistic face, Lifelike skin Texture, Unreal Engine 5, Octane Render, `;


const ImageStudio: React.FC = () => {
    const [historyItems, setHistoryItems] = useState<ImageHistoryItem[]>([]);
    const [favoritesOnly, setFavoritesOnly] = useState(false);

    const isInitialized = useRef(false);

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const serverHistory = await fetchImageHistory();
                if (Array.isArray(serverHistory)) {
                    setHistoryItems(serverHistory);
                }
            } catch (err) {
                console.error('Failed to load image history', err);
            } finally {
                isInitialized.current = true;
            }
        };
        loadHistory();
    }, []);

    useEffect(() => {
        if (!isInitialized.current) return;
        saveImageHistory(historyItems);
    }, [historyItems]);
    const [prompt, setPrompt] = useState(DEFAULT_PROMPT_TEMPLATE);
    const [negativePrompt, setNegativePrompt] = useState('');
    const [mode, setMode] = useState<ImageMode>('Generate');
    const [aspectRatio, setAspectRatio] = useState('9:16');
    const [activeCheatKeys, setActiveCheatKeys] = useState<string[]>([]);
    const [originalImage, setOriginalImage] = useState<{ file: File; url: string; id: string } | null>(null);
    const [characterReference, setCharacterReference] = useState<{ file: File; url: string; id: string } | null>(null);
    const [backgroundReference, setBackgroundReference] = useState<{ file: File; url: string; id: string } | null>(null);
    const [templateReference, setTemplateReference] = useState<{ file: File; url: string; id: string } | null>(null);
    const [generatedImage, setGeneratedImage] = useState<{ url: string; id: string } | null>(null);
    const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [historyImages, setHistoryImages] = useState<Record<string, string>>({});
    const [noGuard, setNoGuard] = useState(false);
    const [enhanceBackground, setEnhanceBackground] = useState(false);
    const [removeBackground, setRemoveBackground] = useState(false);
    const [isProMode, setIsProMode] = useState(false);
    const [isInpaintMode, setIsInpaintMode] = useState(false);
    const [brushSize, setBrushSize] = useState(30);
    const [cheatKeySearch, setCheatKeySearch] = useState('');
    const [showMoveObjectGuide, setShowMoveObjectGuide] = useState(false);
    const [isCheatKeysOpen, setIsCheatKeysOpen] = useState(true);
    const [isHistoryOpen, setIsHistoryOpen] = useState(true);
    const [isSignatureCollectionsOpen, setIsSignatureCollectionsOpen] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
    const [fashionOpen, setFashionOpen] = useState(false);
    const [wardrobeOpen, setWardrobeOpen] = useState({ tops: false, bottoms: false, dresses: false });
    const [categoryOrder, setCategoryOrder] = useState<string[]>([]);

    // Character Collection State
    const [characterCollection, setCharacterCollection] = useState<CharacterCollection[]>([]);
    const [isSaveCharacterModalOpen, setIsSaveCharacterModalOpen] = useState(false);
    const [selectedItemForCharacter, setSelectedItemForCharacter] = useState<ImageHistoryItem | null>(null);

    // Model Selection State
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [imageModel, setImageModel] = useState<string>('imagen-4.0-generate-001');
    const [isModelLoading, setIsModelLoading] = useState(false);

    useEffect(() => {
        handleRefreshModels();
    }, []);

    const handleRefreshModels = async () => {
        setIsModelLoading(true);
        try {
            const models = await fetchAvailableModels();
            if (models.length > 0) {
                setAvailableModels(models);
            }
        } catch (e) {
            console.error("Failed to load models", e);
        } finally {
            setIsModelLoading(false);
        }
    };
    const [isCharacterCollectionOpen, setIsCharacterCollectionOpen] = useState(false);
    const [characterImages, setCharacterImages] = useState<Record<string, string>>({});


    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    // Initialize category order
    useEffect(() => {
        if (categoryOrder.length === 0 && Object.keys(cheatKeysData).length > 0) {
            setCategoryOrder(Object.keys(cheatKeysData));
        }
    }, [cheatKeysData, categoryOrder.length]);

    // Load character collection from server storage
    useEffect(() => {
        const loadCollection = async () => {
            try {
                const saved = await getAppStorageValue<CharacterCollection[] | null>('characterCollection', null);
                if (saved && Array.isArray(saved)) {
                    setCharacterCollection(saved);
                }
            } catch (e) {
                console.warn('Failed to load character collection', e);
            }
        };
        loadCollection();
    }, []);

    // Save character collection to server storage whenever it changes
    useEffect(() => {
        if (characterCollection.length > 0) {
            setAppStorageValue('characterCollection', characterCollection);
        }
    }, [characterCollection]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const characterRefInputRef = useRef<HTMLInputElement>(null);
    const backgroundRefInputRef = useRef<HTMLInputElement>(null);
    const templateRefInputRef = useRef<HTMLInputElement>(null);
    const displayCanvasRef = useRef<HTMLCanvasElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);
    const lastPositionRef = useRef<{ x: number; y: number } | null>(null);

    const flatCheatKeyMap = useMemo(() => {
        const map = new Map<string, CheatKey>();
        Object.values(cheatKeysData as CheatKeyCategoryData).flat().forEach(key => {
            map.set(key.id, key);
        });
        return map;
    }, []);
    const createdHistoryUrlsRef = useRef<string[]>([]);

    // [PERFORMANCE] Performance refs for URL loading (same as ShortsScriptGenerator)
    const isMountedRef = useRef(true);
    const loadingIdsRef = useRef<Set<string>>(new Set());
    const loadedIdsRef = useRef<Set<string>>(new Set());
    const loadUrlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // [PERFORMANCE] Same loadUrls implementation as ShortsScriptGenerator
    const loadUrls = async () => {
        if (historyItems.length === 0) return;

        const needsLoad = historyItems.filter(item =>
            (item.generatedImageId || item.localFilename) &&
            !historyImages[item.id] &&
            !loadingIdsRef.current.has(item.id) &&
            !loadedIdsRef.current.has(item.id)
        );

        if (needsLoad.length === 0) return;

        console.log(`[Performance] Loading ${needsLoad.length} new thumbnails (${loadedIdsRef.current.size} already loaded)`);

        needsLoad.forEach(item => loadingIdsRef.current.add(item.id));

        const fetchFromLocalFile = async (filename: string): Promise<string | null> => {
            const candidates = [
                `/generated_scripts/images/${filename}`,
                `http://localhost:3002/generated_scripts/images/${filename}`,
                `http://127.0.0.1:3002/generated_scripts/images/${filename}`
            ];
            for (const url of candidates) {
                try {
                    const resp = await fetch(url);
                    if (resp.ok) {
                        const blob = await resp.blob();
                        return URL.createObjectURL(blob);
                    }
                } catch (e) {
                    // Ignore failure, try next candidate
                }
            }
            return null;
        };

        const newUrls: Record<string, string> = {};
        await Promise.all(needsLoad.map(async (item) => {
            try {
                let url: string | null = null;
                // 1. Try Loading Blob from DB
                if (item.generatedImageId) {
                    const blob = await getBlob(item.generatedImageId);
                    if (blob) {
                        url = URL.createObjectURL(blob);
                    }
                }

                // 2. Try Loading from Local File (Fallback)
                if (!url && item.localFilename) {
                    url = await fetchFromLocalFile(item.localFilename);
                }

                if (url && isMountedRef.current) {
                    newUrls[item.id] = url;
                    createdHistoryUrlsRef.current.push(url);
                    loadedIdsRef.current.add(item.id);
                }
            } catch (e) {
                console.error(`Failed to load image for item ${item.id}`, e);
            } finally {
                loadingIdsRef.current.delete(item.id);
            }
        }));

        if (isMountedRef.current && Object.keys(newUrls).length > 0) {
            setHistoryImages(prev => ({ ...prev, ...newUrls }));
            console.log(`[Performance] Loaded ${Object.keys(newUrls).length} thumbnails successfully`);
        }
    };

    // [PERFORMANCE] Debounced image loading - only load after 300ms of no changes
    useEffect(() => {
        if (loadUrlsTimeoutRef.current) {
            clearTimeout(loadUrlsTimeoutRef.current);
        }

        loadUrlsTimeoutRef.current = setTimeout(() => {
            loadUrls();
        }, 300);

        return () => {
            if (loadUrlsTimeoutRef.current) {
                clearTimeout(loadUrlsTimeoutRef.current);
            }
        };
    }, [historyItems]);

    useEffect(() => {
        return () => {
            createdHistoryUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        };
    }, []);

    // Sync with disk (merge new files found on disk into history)
    useEffect(() => {
        const syncWithDisk = async () => {
            const files = await fetchDiskImageList();
            if (files.length === 0) return;

            setHistoryItems(prev => {
                const existingFilenames = new Set(prev.map(item => item.localFilename).filter(Boolean));
                const newFiles = files.filter(f => !existingFilenames.has(f));

                if (newFiles.length === 0) return prev;

                const newItems = newFiles.map((filename, idx) => ({
                    id: `disk-${Date.now()}-${idx}-${filename}`,
                    prompt: filename.replace(/^\d{4}-\d{2}-\d{2}T[\d-]*Z_/, '').replace(/\.png$/i, '').replace(/_/g, ' '),
                    generatedImageId: '',
                    favorite: false,
                    createdAt: Date.now(),
                    localFilename: filename,
                    settings: {
                        mode: 'Generate',
                        aspectRatio: '9:16',
                        activeCheatKeys: [],
                        noGuard: false,
                        enhanceBackground: false,
                        removeBackground: false,
                        creativity: 0.8,
                        isProMode: false,
                        isInpaintMode: false
                    }
                } as ImageHistoryItem));

                // Merge and sort by filename (timestamp) descending
                const combined = [...newItems, ...prev];
                // Remove duplicates based on localFilename just in case
                const uniqueMap = new Map();
                combined.forEach(item => {
                    if (item.localFilename) {
                        if (!uniqueMap.has(item.localFilename)) uniqueMap.set(item.localFilename, item);
                    } else {
                        uniqueMap.set(item.id, item);
                    }
                });

                const uniqueItems = Array.from(uniqueMap.values());

                uniqueItems.sort((a, b) => {
                    const nameA = a.localFilename || '';
                    const nameB = b.localFilename || '';
                    return nameB.localeCompare(nameA);
                });

                return uniqueItems;
            });
        };
        syncWithDisk();
    }, []);

    // Load character collection thumbnails from IndexedDB
    useEffect(() => {
        const urls: Record<string, string> = {};
        const loadCharacterImages = async () => {
            if (!Array.isArray(characterCollection)) return;
            for (const character of characterCollection) {
                if (character.generatedImageId) {
                    try {
                        const blob = await getBlob(character.generatedImageId);
                        if (blob) {
                            urls[character.id] = URL.createObjectURL(blob);
                        }
                    } catch (e) { console.error(`Failed to load character image ${character.generatedImageId}`, e); }
                }
            }
            setCharacterImages(urls);
        };
        loadCharacterImages();

        return () => {
            Object.values(urls).forEach(URL.revokeObjectURL);
        };
    }, [characterCollection]);


    // Cleanup inpaint mode when switching main modes or image changes
    useEffect(() => {
        if (mode !== 'Edit') {
            setIsInpaintMode(false);
        }
    }, [mode]);

    useEffect(() => {
        if (mode === 'Edit' && isInpaintMode && originalImage) {
            setupInpaintCanvas(originalImage.url);
        }
    }, [mode, isInpaintMode, originalImage]);

    const setupInpaintCanvas = (imageUrl: string) => {
        const displayCanvas = displayCanvasRef.current;
        const maskCanvas = maskCanvasRef.current;
        if (!displayCanvas || !maskCanvas) return;

        const dpr = window.devicePixelRatio || 1;
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = imageUrl;
        image.onload = () => {
            // Wait for next frame to ensure parent container has layout
            requestAnimationFrame(() => {
                const container = displayCanvas.parentElement;
                if (!container) return;

                const containerWidth = container.clientWidth;
                const containerHeight = container.clientHeight;

                if (containerWidth === 0 || containerHeight === 0) return;

                const imageAspectRatio = image.width / image.height;
                const containerAspectRatio = containerWidth / containerHeight;

                let canvasWidth, canvasHeight;
                if (imageAspectRatio > containerAspectRatio) {
                    canvasWidth = containerWidth;
                    canvasHeight = containerWidth / imageAspectRatio;
                } else {
                    canvasHeight = containerHeight;
                    canvasWidth = containerHeight * imageAspectRatio;
                }

                [displayCanvas, maskCanvas].forEach(canvas => {
                    canvas.style.width = `${canvasWidth}px`;
                    canvas.style.height = `${canvasHeight}px`;
                    canvas.width = canvasWidth * dpr;
                    canvas.height = canvasHeight * dpr;
                    const ctx = canvas.getContext('2d');
                    ctx?.scale(dpr, dpr);
                });

                // Clear displays
                const displayCtx = displayCanvas.getContext('2d');
                const maskCtx = maskCanvas.getContext('2d');

                // Clear both canvases to transparent
                displayCtx?.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
                if (maskCtx) {
                    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
                }

                // We DO NOT draw the image on displayCanvas anymore, because we reference the <img> tag under it.
                // This prevents the "Double Image" ghosting effect.

                // Reset drawing state
                isDrawingRef.current = false;
            });
        };
    };

    const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = maskCanvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (mode !== 'Edit' || !isInpaintMode) return;
        isDrawingRef.current = true;
        const coords = getCanvasCoordinates(e);
        if (coords) lastPositionRef.current = coords;
        draw(e);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current || mode !== 'Edit' || !isInpaintMode) return;
        const canvas = maskCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const coords = getCanvasCoordinates(e);
        if (!coords || !lastPositionRef.current) return;

        ctx.beginPath();
        ctx.moveTo(lastPositionRef.current.x, lastPositionRef.current.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; // Visual feedback color (red)
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Also draw on a hidden canvas for the actual mask if needed, 
        // but for now we'll use the same canvas and process it when generating.

        lastPositionRef.current = coords;
    };

    const stopDrawing = () => {
        isDrawingRef.current = false;
        lastPositionRef.current = null;
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const processDrop = async (e: React.DragEvent, targetType: 'original' | 'character' | 'background' | 'template') => {
        e.preventDefault();
        e.stopPropagation();

        // 1. Handle File Drop (from desktop)
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                await handleImageUpload(file, targetType);
            }
            return;
        }

        // 2. Handle Image History Drop (from sidebar)
        const jsonString = e.dataTransfer.getData('application/json');
        if (jsonString) {
            try {
                const data = JSON.parse(jsonString);
                if (data.type === 'image-history') {
                    let file: File | null = null;

                    if (data.generatedImageId) {
                        const blob = await getBlob(data.generatedImageId);
                        if (blob) {
                            file = new File([blob], `history_${data.id}.png`, { type: blob.type });
                        }
                    } else if (data.localFilename) {
                        // Disk image support for drag and drop
                        const serverUrl = `http://localhost:3002/generated_scripts/images/${data.localFilename}`;
                        try {
                            const resp = await fetch(serverUrl);
                            if (resp.ok) {
                                const blob = await resp.blob();
                                file = new File([blob], data.localFilename, { type: blob.type });
                            }
                        } catch (err) {
                            console.error('Failed to fetch disk image for drop:', err);
                        }
                    }

                    if (file) {
                        await handleImageUpload(file, targetType);
                    }
                }
            } catch (err) {
                console.error('Failed to process history drop:', err);
            }
        }
    };

    const handleImageUpload = useCallback(async (file: File | null, type: 'original' | 'character' | 'background' | 'template') => {
        if (!file) return;

        const imageId = uuidv4();
        await setBlob(imageId, file);
        const imageUrl = URL.createObjectURL(file);
        const imageState = { file, url: imageUrl, id: imageId };

        const isNewImageBasedMode = ['Edit', 'Variations'].includes(mode) && (type === 'original' || type === 'character');
        if (isNewImageBasedMode) {
            setPrompt('');
            // setNegativePrompt(''); // Not defined in this scope based on previous view, removing to be safe or check if needed
            setActiveCheatKeys([]);
            setEnhanceBackground(false);
            setRemoveBackground(false);
        }

        switch (type) {
            case 'original':
                setOriginalImage(imageState);
                setGeneratedImage(null);
                // Auto-switch to Edit mode if in Generate mode so the user can see the uploaded image
                if (mode === 'Generate') {
                    setMode('Edit');
                }
                // setupInpaintCanvas called via useEffect
                break;
            case 'character':
                setCharacterReference(imageState);
                break;
            case 'background':
                setBackgroundReference(imageState);
                break;
            case 'template':
                setTemplateReference(imageState);
                break;
        }
    }, [mode]);


    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        setGeneratedImage(null);

        let finalPrompt = prompt;

        try {
            if (enhanceBackground) finalPrompt += ', stunning background, masterpiece background, detailed environment';
            if (removeBackground) finalPrompt += ", remove the background, transparent background, alpha channel";

            const safetySettings = noGuard ? [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE }
            ] : undefined;

            let response: GenerateContentResponse | any;
            let originalImageId: string | undefined = undefined;
            let characterReferenceImageId: string | undefined = undefined;
            let backgroundReferenceImageId: string | undefined = undefined;
            let templateReferenceImageId: string | undefined = undefined;

            // Determine which model to use
            const isImagenModel = imageModel.toLowerCase().includes('imagen');
            // Fallback for Edit/Reference modes if an Imagen model is selected (Imagen doesn't support these via generateContent yet)
            const effectiveGeminiModel = isImagenModel ? 'gemini-2.5-flash-image' : imageModel;

            if (mode === 'Generate' && isImagenModel) {
                // Pass safetySettings to generateImageWithImagen
                response = await generateImageWithImagen(finalPrompt, negativePrompt, { aspectRatio, model: imageModel }, safetySettings);
            } else {
                if (negativePrompt.trim()) {
                    finalPrompt += `, Negative Prompt: ${negativePrompt.trim()}`;
                }

                const imageParts: { inlineData: { data: string, mimeType: string } }[] = [];

                if (mode === 'Reference') {
                    if (characterReference) {
                        const charBase64 = await fileToBase64(characterReference.file);
                        imageParts.push({ inlineData: { data: charBase64, mimeType: characterReference.file.type } });
                        characterReferenceImageId = characterReference.id;
                    }
                    if (backgroundReference) {
                        const bgBase64 = await fileToBase64(backgroundReference.file);
                        imageParts.push({ inlineData: { data: bgBase64, mimeType: backgroundReference.file.type } });
                        backgroundReferenceImageId = backgroundReference.id;
                    }
                    if (templateReference) {
                        const templateBase64 = await fileToBase64(templateReference.file);
                        imageParts.push({ inlineData: { data: templateBase64, mimeType: templateReference.file.type } });
                        templateReferenceImageId = templateReference.id;
                    }

                    if (characterReference && backgroundReference && templateReference) {
                        finalPrompt = `The final image must be a composition. The main scene is described by the user prompt: "${prompt}". This scene must feature a character whose appearance is strictly based on the **first reference image**, and a background environment strictly based on the **second reference image**. Crucially, this entire generated scene must be perfectly composited within the frame and layout of the **third reference image**, which acts as a template. Do not alter the template itself, only fill its designated content area.`;
                    } else if (characterReference && backgroundReference) {
                        finalPrompt = `Use the first image as a reference for the character's FACE ONLY (facial features, not clothing), and the second image for the background environment. The clothing must follow the new prompt description. Generate a new scene based on the following prompt, combining them. Only change the character's action, pose, or expression as described. Prompt: "${finalPrompt}"`;
                    } else if (characterReference) {
                        finalPrompt = `Use the provided image as a strict reference for the character's FACE ONLY (facial features, face shape, eyes, nose, mouth, skin tone, hair). DO NOT copy the clothing or outfit from the reference image. The clothing, outfit, and accessories must follow the new prompt description below. Generate a new scene based on the following prompt. Prompt: "${finalPrompt}"`;
                    }
                    response = await generateImage(finalPrompt, { aspectRatio, model: effectiveGeminiModel }, safetySettings, imageParts);
                }
                else if ((mode === 'Edit' || mode === 'Variations' || mode === 'Upscale') && originalImage) {
                    const base64 = await fileToBase64(originalImage.file);
                    const imagePart = { inlineData: { data: base64, mimeType: originalImage.file.type } };
                    originalImageId = originalImage.id;

                    if (mode === 'Edit' && isInpaintMode) {
                        const maskCanvas = maskCanvasRef.current;
                        if (!maskCanvas) throw new Error("Mask canvas is not available.");

                        // Create a new canvas to process the mask into pure B/W or Alpha for the API
                        // Since we drew with semi-transparent red, we need to convert it to a proper mask.
                        // Gemini usually accepts standard image formats. Let's send the mask as PNG.
                        // Ideally, masked areas should be distinct. 
                        // Let's rely on the drawn content.

                        const processedMaskCanvas = document.createElement('canvas');
                        processedMaskCanvas.width = maskCanvas.width;
                        processedMaskCanvas.height = maskCanvas.height;
                        const pCtx = processedMaskCanvas.getContext('2d');
                        if (!pCtx) throw new Error("Failed to create processing canvas");

                        // Draw the drawn mask onto the processing canvas
                        pCtx.drawImage(maskCanvas, 0, 0);

                        // Convert to solid mask (White pixels on Transparent background)
                        // This makes it easier for the AI to understand "This is the mask"
                        const imgData = pCtx.getImageData(0, 0, processedMaskCanvas.width, processedMaskCanvas.height);
                        const data = imgData.data;
                        for (let i = 0; i < data.length; i += 4) {
                            // If pixel has any alpha (was painted), make it solid white
                            if (data[i + 3] > 0) {
                                data[i] = 255;     // R
                                data[i + 1] = 255; // G
                                data[i + 2] = 255; // B
                                data[i + 3] = 255; // Alpha
                            }
                        }
                        pCtx.putImageData(imgData, 0, 0);

                        console.log("[Inpaint Debug] Mask processing complete.");

                        const maskBlob = await new Promise<Blob | null>(resolve => processedMaskCanvas.toBlob(resolve, 'image/png'));
                        if (!maskBlob) throw new Error("Failed to create mask blob.");
                        console.log("[Inpaint Debug] Mask blob created:", maskBlob.size, "bytes");

                        const maskBase64 = await blobToBase64(maskBlob);
                        const maskPart = { inlineData: { data: maskBase64, mimeType: 'image/png' } };
                        finalPrompt = `Only paint inside the masked area. Do not change anything else. Prompt: "${prompt}"`;

                        console.log("[Inpaint Debug] Sending request to Gemini...");
                        console.log("[Inpaint Debug] Prompt:", finalPrompt);

                        response = await editImage(finalPrompt, imagePart, { aspectRatio, model: effectiveGeminiModel }, safetySettings, undefined, maskPart);
                        console.log("[Inpaint Debug] Response received:", response);
                    } else {
                        response = await editImage(finalPrompt, imagePart, { aspectRatio, model: effectiveGeminiModel }, safetySettings);
                    }
                }
                else { // Generate
                    // If character reference exists, use it for consistent face generation
                    if (characterReference) {
                        const charBase64 = await fileToBase64(characterReference.file);
                        const imageParts = [{ inlineData: { data: charBase64, mimeType: characterReference.file.type } }];
                        characterReferenceImageId = characterReference.id;
                        finalPrompt = `Use the provided image as a strict reference for the character's FACE ONLY (facial features, face shape, eyes, nose, mouth, skin tone, hair). DO NOT copy the clothing or outfit from the reference image. The clothing, outfit, and accessories must follow the new prompt description below. Generate a new scene based on the following prompt. Prompt: "${finalPrompt}"`;
                        response = await generateImage(finalPrompt, { aspectRatio, model: effectiveGeminiModel }, safetySettings, imageParts);
                    } else {
                        response = await generateImage(finalPrompt, { aspectRatio, model: effectiveGeminiModel }, safetySettings);
                    }
                }
            }

            let imagePartData: { data: string, mimeType: string } | undefined | null = null;

            if (response && 'generatedImages' in response) {
                // Safe access for Imagen response (ImageGenerateResponse)
                if (response.generatedImages && response.generatedImages.length > 0) {
                    const generatedImage = response.generatedImages[0];
                    if (generatedImage?.image?.imageBytes) {
                        imagePartData = { data: generatedImage.image.imageBytes, mimeType: 'image/png' };
                    }
                }
            } else if (response) {
                // Safe access for Gemini response (GenerateContentResponse)
                imagePartData = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData;
            }

            if (!imagePartData?.data) {
                // Fix: Use type narrowing or optional chaining to safely access properties
                let blockReason = 'Unknown';
                if (response && 'candidates' in response) {
                    blockReason = response.candidates?.[0]?.safetyRatings?.find(r => r.blocked)?.category || 'Safety Filter';
                } else {
                    blockReason = 'Safety Filter (Pro Mode) or API Error';
                }
                throw new Error(`이미지 생성이 안전 정책 등의 이유로 차단되었거나 실패했습니다. (이유: ${blockReason}). 프롬프트를 수정하거나 가드 해제를 확인해주세요.`);
            }

            const imageBlob = await fetch(`data:${imagePartData.mimeType};base64,${imagePartData.data}`).then(res => res.blob());
            const imageId = uuidv4();
            await setBlob(imageId, imageBlob);

            // Save to local disk
            const base64Image = await blobToBase64(imageBlob);
            const saveResult = await saveImageToDisk(base64Image, prompt);
            const savedLocalFilename = saveResult?.filename;

            const newHistoryItem: ImageHistoryItem = {
                id: uuidv4(),
                prompt: prompt,
                generatedImageId: imageId,
                favorite: false,
                createdAt: Date.now(),
                originalImageId,
                characterReferenceImageId,
                backgroundReferenceImageId,
                templateReferenceImageId,
                settings: {
                    mode, aspectRatio, activeCheatKeys, noGuard, enhanceBackground, removeBackground, creativity: 0.8, isProMode, isInpaintMode
                },
                localFilename: savedLocalFilename || undefined,
            };
            setHistoryItems(prev => [newHistoryItem, ...(Array.isArray(prev) ? prev : [])].slice(0, 50));

            const url = URL.createObjectURL(imageBlob);
            setGeneratedImage({ url, id: imageId });
            setNotification({ message: '이미지가 생성되고 저장되었습니다.', type: 'success' });

        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            setError(errorMessage);
            setNotification({ message: `생성 실패: ${errorMessage}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const loadFromHistory = async (item: ImageHistoryItem) => {
        setPrompt(item.prompt);
        setMode(item.settings.mode);
        setAspectRatio(item.settings.aspectRatio);
        setActiveCheatKeys(item.settings.activeCheatKeys);
        setNoGuard(item.settings.noGuard);
        setEnhanceBackground(item.settings.enhanceBackground);
        setRemoveBackground(item.settings.removeBackground);
        setIsProMode(item.settings.isProMode ?? false);
        setIsInpaintMode(item.settings.isInpaintMode ?? false);

        if (generatedImage?.url) URL.revokeObjectURL(generatedImage.url);

        const loadImage = async (id: string | undefined, setter: Function) => {
            if (id) {
                const blob = await getBlob(id);
                if (blob) {
                    const file = new File([blob], `history_image_${id}`, { type: blob.type });
                    setter({ file, url: URL.createObjectURL(blob), id });
                    return;
                }
            }
            setter(null);
        };

        await loadImage(item.originalImageId, setOriginalImage);
        await loadImage(item.characterReferenceImageId, setCharacterReference);
        await loadImage(item.backgroundReferenceImageId, setBackgroundReference);
        await loadImage(item.templateReferenceImageId, setTemplateReference);

        const applyGeneratedImage = async () => {
            if (item.generatedImageId) {
                await loadImage(item.generatedImageId, (img: any) =>
                    setGeneratedImage(img ? { url: img.url, id: img.id } : null)
                );
                return;
            }
            const existingUrl = historyImages[item.id];
            if (existingUrl) {
                setGeneratedImage({ url: existingUrl, id: item.id });
                return;
            }
            if (item.localFilename) {
                const candidates = [
                    `/generated_scripts/images/${item.localFilename}`,
                    `http://localhost:3002/generated_scripts/images/${item.localFilename}`,
                    `http://127.0.0.1:3002/generated_scripts/images/${item.localFilename}`,
                ];
                for (const url of candidates) {
                    try {
                        const resp = await fetch(url);
                        if (resp.ok) {
                            const blob = await resp.blob();
                            const objectUrl = URL.createObjectURL(blob);
                            setHistoryImages((prev) => ({ ...prev, [item.id]: objectUrl }));
                            setGeneratedImage({ url: objectUrl, id: item.id });
                            return;
                        }
                    } catch (error) {
                        console.error('Failed to fetch disk image', error);
                    }
                }
            }
            setGeneratedImage(null);
        };

        await applyGeneratedImage();
    };

    const deleteFromHistory = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!Array.isArray(historyItems)) return;
        const itemToDelete = historyItems.find(item => item.id === id);
        if (itemToDelete) {
            await deleteBlob(itemToDelete.generatedImageId);
            if (itemToDelete.localFilename) {
                try {
                    await deleteFileFromDisk(itemToDelete.localFilename, 'image');
                    setNotification({ message: '이미지 파일이 삭제되었습니다.', type: 'success' });
                } catch (e) {
                    console.error("Local file delete failed", e);
                    setNotification({ message: '로컬 파일 삭제 실패 (DB는 삭제됨)', type: 'error' });
                }
            }
        }
        setHistoryItems(prev => Array.isArray(prev) ? prev.filter(item => item.id !== id) : []);
        if (historyImages[id]) {
            URL.revokeObjectURL(historyImages[id]);
            setHistoryImages(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        }
    };

    const toggleFavorite = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setHistoryItems(prev => Array.isArray(prev)
            ? prev.map(item => item.id === id ? { ...item, favorite: !item.favorite } : item)
            : prev);
    };

    const handleSaveCharacter = (item: ImageHistoryItem, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedItemForCharacter(item);
        setIsSaveCharacterModalOpen(true);
    };

    const handleSaveCharacterConfirm = async (name: string, description: string) => {
        if (!selectedItemForCharacter) return;

        // Note: We don't store thumbnail to avoid storage quota issues
        // The image can be loaded later using generatedImageId from IndexedDB

        const newCharacter: CharacterCollection = {
            id: uuidv4(),
            name,
            description,
            // thumbnail is omitted to save storage space
            generatedImageId: selectedItemForCharacter.generatedImageId
        };

        setCharacterCollection(prev => [newCharacter, ...prev]);
        setNotification({ message: `캐릭터 "${name}"이(가) 저장되었습니다!`, type: 'success' });
        setSelectedItemForCharacter(null);
    };

    const deleteCharacter = (id: string) => {
        if (!confirm('이 캐릭터를 삭제하시겠습니까?')) return;
        setCharacterCollection(prev => prev.filter(char => char.id !== id));
        setNotification({ message: '캐릭터가 삭제되었습니다.', type: 'success' });
    };

    const loadCharacter = async (character: CharacterCollection) => {
        // Switch to Reference mode
        setMode('Reference');

        // Load character image and display it on the right panel

        // Load character image if available
        if (character.generatedImageId) {
            try {
                const blob = await getBlob(character.generatedImageId);
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const file = new File([blob], `${character.name}.png`, { type: 'image/png' });

                    // Display in the right panel (generated image area)
                    setGeneratedImage({
                        url,
                        id: character.generatedImageId
                    });

                    // Also set as character reference for generation (hidden from user)
                    setCharacterReference({
                        file,
                        url,
                        id: character.generatedImageId
                    });

                    setNotification({ message: `캐릭터 "${character.name}" 이미지 로드됨!`, type: 'success' });
                } else {
                    setNotification({ message: '이미지를 찾을 수 없습니다.', type: 'error' });
                }
            } catch (error) {
                console.error('Failed to load character image:', error);
                setNotification({ message: '이미지 로드 실패', type: 'error' });
            }
        }

        // Inject character description into prompt
        const characterTag = `[Character: ${character.description}]`;
        setPrompt(prev => {
            // If there's already a [Character: ...] tag, replace it
            const characterRegex = /\[Character:.*?\]/g;
            if (characterRegex.test(prev)) {
                return prev.replace(characterRegex, characterTag);
            }
            // Otherwise, prepend it
            return `${characterTag}\n${prev}`;
        });
    };

    const handleEnhance = async () => {
        if (!prompt.trim()) return;
        setIsEnhancing(true);
        try {
            const enhanced = await enhancePrompt(prompt);
            setPrompt(enhanced);
        } catch (e) {
            console.error("Enhancement failed", e);
            window.alert("프롬프트 후처리에 실패했습니다.");
        } finally {
            setIsEnhancing(false);
        }
    };

    const toggleCheatKey = (id: string) => {
        const keyData = flatCheatKeyMap.get(id);
        if (!keyData) return;

        const keyPrompt = keyData.prompt.trim();
        const isActive = activeCheatKeys.includes(id);

        let newActiveKeys = [...activeCheatKeys];
        let newPrompt = prompt;

        // Handle deactivation of any key
        if (isActive) {
            newActiveKeys = newActiveKeys.filter(k => k !== id);
            // Fix: Robustly remove the prompt text, even if it contains commas.
            newPrompt = prompt.replace(keyPrompt, '');
            // Clean up dangling commas and extra spaces that might result from the replacement
            newPrompt = newPrompt.split(',')
                .map(p => p.trim())
                .filter(p => p) // Remove empty parts
                .join(', ');
        }
        // Handle activation
        else {
            // If it's a camera key, handle mutual exclusion
            if (keyData.aspectRatioGroup) {
                // Find and remove any other active camera key from prompt and active keys list
                const otherCameraKeyId = newActiveKeys.find(activeId => {
                    const activeKeyData = flatCheatKeyMap.get(activeId);
                    return activeKeyData && activeKeyData.aspectRatioGroup;
                });

                if (otherCameraKeyId) {
                    const otherCameraKeyData = flatCheatKeyMap.get(otherCameraKeyId);
                    newActiveKeys = newActiveKeys.filter(k => k !== otherCameraKeyId);
                    if (otherCameraKeyData) {
                        // Also remove the old camera prompt using the same robust method
                        let tempPrompt = newPrompt.replace(otherCameraKeyData.prompt.trim(), '');
                        newPrompt = tempPrompt.split(',')
                            .map(p => p.trim())
                            .filter(p => p)
                            .join(', ');
                    }
                }

                // Set the aspect ratio for the newly activated camera key
                setAspectRatio(keyData.aspectRatioGroup);
            }

            // Add the new key to active keys and prompt
            newActiveKeys.push(id);
            newPrompt = newPrompt.trim() ? `${newPrompt.trim()}, ${keyPrompt}` : keyPrompt;
        }

        setActiveCheatKeys(newActiveKeys);
        setPrompt(newPrompt);
    };

    const filteredCheatKeys = useMemo(() => {
        const data = cheatKeysData as CheatKeyCategoryData;
        if (!cheatKeySearch) return data;
        const lowerCaseSearch = cheatKeySearch.toLowerCase();
        const filtered: CheatKeyCategoryData = {};
        for (const category in data) {
            const keys = data[category].filter(
                key => key.label.toLowerCase().includes(lowerCaseSearch) || key.description.toLowerCase().includes(lowerCaseSearch)
            );
            if (keys.length > 0) {
                filtered[category] = keys;
            }
        }
        return filtered;
    }, [cheatKeySearch]);

    return (
        <div className="flex h-full bg-black/20">
            <Lightbox imageUrl={lightboxImageUrl} onClose={() => setLightboxImageUrl(null)} />
            {showMoveObjectGuide && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50 p-4" onClick={() => setShowMoveObjectGuide(false)}>
                    <div className="bg-gray-900/80 border border-purple-500/50 rounded-2xl p-8 max-w-2xl text-left shadow-2xl shadow-purple-500/20" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold mb-4 text-purple-300 flex items-center"><Paintbrush className="mr-3" /> 객체 이동 가이드 / Move Object Guide</h2>
                        <p className="text-gray-300 mb-4">
                            '인페인트' 모드는 이미지의 특정 부분만 수정하는 강력한 기능입니다. 아래 단계에 따라 이미지 속 객체를 원하는 위치로 옮겨보세요.
                        </p>
                        <ol className="list-decimal list-inside space-y-3 text-gray-200">
                            <li><span className="font-semibold">영역 지정:</span> 브러시를 사용하여 객체를 <strong className="text-yellow-300">이동시키고 싶은 새로운 위치</strong>를 칠하세요. (원래 객체가 있던 자리가 아닙니다!)</li>
                            <li><span className="font-semibold">프롬프트 작성:</span> 칠한 영역에 <strong className="text-yellow-300">무엇이 나타나야 하는지</strong> 명확하게 묘사해주세요. <br /> (예: "테디베어 후드를 입은 소녀가 여기 앉아 있다 / a girl in a teddy bear hoodie is sitting here")</li>
                            <li><span className="font-semibold">생성:</span> '참조 이미지 생성' 버튼을 눌러 마법을 확인하세요! AI가 지정된 영역에만 그림을 그릴 것입니다.</li>
                        </ol>
                        <button onClick={() => setShowMoveObjectGuide(false)} className="mt-6 w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-all">알겠습니다! / Got it!</button>
                    </div>
                </div>
            )}

            {/* Left Panel */}
            <div className="w-[45%] flex flex-col p-4 space-y-3 overflow-hidden">
                {/* Mode Selector */}
                <div className="flex-none grid grid-cols-5 gap-2 bg-gray-900/50 p-2 rounded-lg border border-white/10">
                    {(['Generate', 'Edit', 'Variations', 'Upscale', 'Reference'] as ImageMode[]).map(m =>
                        <button key={m} onClick={() => setMode(m)} className={`px-2 py-2 text-sm font-semibold rounded-md transition-all ${mode === m ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-700/50 hover:bg-gray-600/50'}`}>
                            {m === 'Generate' && '이미지 생성'}
                            {m === 'Edit' && '이미지 편집'}
                            {m === 'Variations' && '변형 생성'}
                            {m === 'Upscale' && '업스케일링'}
                            {m === 'Reference' && '참조 생성'}
                        </button>
                    )}
                </div>

                <div className="flex-1 flex flex-col space-y-3 overflow-y-auto pr-2 -mr-2">
                    {/* Prompt Area */}
                    <div className="p-4 bg-gray-900/50 rounded-lg border border-white/10">
                        {/* Signature Collections Accordion */}
                        <div className="mb-3 bg-gray-800/50 rounded-lg border border-white/10 overflow-hidden">
                            <button
                                onClick={() => setIsSignatureCollectionsOpen(!isSignatureCollectionsOpen)}
                                className="w-full flex justify-between items-center p-3 text-md font-bold text-purple-300 hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center">
                                    <Library className="mr-2" size={18} />
                                    <span>Signature Collections / 시그니처 컬렉션</span>
                                </div>
                                {isSignatureCollectionsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>

                            {isSignatureCollectionsOpen && (
                                <div className="p-3 border-t border-white/10">
                                    {/* Template Buttons */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setPrompt(masterPromptTemplate)}
                                            className="w-full bg-purple-700/80 hover:bg-purple-600/80 border border-purple-500/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Sparkles className="mr-2 text-yellow-300" />
                                            [Unreal Engine 5 시네마틱 아이소메트릭 디오라마]
                                        </button>
                                        <button
                                            onClick={() => setPrompt(walterFlashPromptTemplate)}
                                            className="w-full bg-teal-700/80 hover:bg-teal-600/80 border border-teal-500/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Wand2 className="mr-2 text-cyan-300" />
                                            월터의 플래시 작품
                                        </button>
                                        <button
                                            onClick={() => setPrompt(closeupPromptTemplate)}
                                            className="w-full bg-blue-700/80 hover:bg-blue-600/80 border border-blue-500/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <User className="mr-2 text-cyan-300" />
                                            인물 클로즈업 템플릿
                                        </button>
                                        <button
                                            onClick={() => setPrompt(ruinCityWomanPrompt)}
                                            className="w-full bg-zinc-700/80 hover:bg-zinc-600/80 border border-zinc-500/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Crosshair className="mr-2 text-red-400" />
                                            루인 시티의 여전사
                                        </button>
                                        <button
                                            onClick={() => setPrompt(backgroundFocusPromptTemplate)}
                                            className="w-full bg-green-700/80 hover:bg-green-600/80 border border-green-500/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Mountain className="mr-2 text-lime-300" />
                                            배경 중심 템플릿
                                        </button>
                                        <button
                                            onClick={() => setPrompt(walterPhotoShootPrompt)}
                                            className="w-full bg-indigo-700/80 hover:bg-indigo-600/80 border border-indigo-500/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Camera className="mr-2 text-pink-300" />
                                            거장 월터의 화보촬영
                                        </button>
                                        <button
                                            onClick={() => setPrompt(walterPhotoShootZippedPrompt)}
                                            className="w-full bg-indigo-800/80 hover:bg-indigo-700/80 border border-indigo-600/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Camera className="mr-2 text-pink-300" />
                                            거장 월터의 화보촬영 - 잠긴 의상: 다비드 핀쳐
                                        </button>
                                        <button
                                            onClick={() => setPrompt(walterPhotoShootZippedWongKarWaiPrompt)}
                                            className="w-full bg-fuchsia-900/80 hover:bg-fuchsia-800/80 border border-fuchsia-700/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Camera className="mr-2 text-pink-300" />
                                            거장 월터의 화보촬영 - 잠긴 의상: 왕가위
                                        </button>
                                        <button
                                            onClick={() => setPrompt(unrealMarketPrompt)}
                                            className="w-full bg-violet-900/80 hover:bg-violet-800/80 border border-violet-700/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Tent className="mr-2 text-violet-300" />
                                            [언리얼5 & 3D/CGI & VFX 전용 템플릿: 시장]
                                        </button>
                                        <button
                                            onClick={() => setPrompt(unrealTavernPrompt)}
                                            className="w-full bg-amber-700/80 hover:bg-amber-600/80 border border-amber-500/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Beer className="mr-2 text-yellow-200" />
                                            [언리얼5 & 3D/CGI & VFX 전용 템플릿: 여관]
                                        </button>
                                        <button
                                            onClick={() => setPrompt(villeneuveDeakinsPrompt)}
                                            className="w-full bg-yellow-700/80 hover:bg-yellow-600/80 border border-yellow-500/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Film className="mr-2 text-orange-200" />
                                            [시네마틱 인물 독백: 드니 빌뇌브 & 로저 디킨스]
                                        </button>
                                        <button
                                            onClick={() => setPrompt(rainyCafePrompt)}
                                            className="w-full bg-blue-900/80 hover:bg-blue-800/80 border border-blue-700/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <CloudRain className="mr-2 text-blue-300" />
                                            [시네마틱 감성: 왕가위 & 비 오는 카페 창가]
                                        </button>
                                        <button
                                            onClick={() => setPrompt(blacksmithWatchPrompt)}
                                            className="w-full bg-red-900/80 hover:bg-red-800/80 border border-red-700/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Hammer className="mr-2 text-orange-400" />
                                            [언리얼5 대장간: 관찰하는 전사]
                                        </button>
                                        <button
                                            onClick={() => setPrompt(blacksmithSleepPrompt)}
                                            className="w-full bg-orange-900/80 hover:bg-orange-800/80 border border-orange-700/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Moon className="mr-2 text-indigo-300" />
                                            [언리얼5 대장간: 자고 있는 전사 (개그)]
                                        </button>
                                        <button
                                            onClick={() => setPrompt(pixarAnimationPrompt)}
                                            className="w-full bg-pink-600/80 hover:bg-pink-500/80 border border-pink-400/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Gamepad className="mr-2 text-yellow-200" />
                                            [3D 애니메이션 스타일: 픽사 & 디즈니]
                                        </button>
                                        <button
                                            onClick={() => setPrompt(winterStreetFashionPrompt)}
                                            className="w-full bg-slate-700/80 hover:bg-slate-600/80 border border-slate-500/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Snowflake className="mr-2 text-cyan-200" />
                                            [겨울 스트릿 패션: 보그 에디토리얼]
                                        </button>
                                        <button
                                            onClick={() => setPrompt(winterNightMoodPrompt)}
                                            className="w-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Star className="mr-2 text-yellow-100" />
                                            [겨울 밤의 무드: 고독하고 시크한 감성]
                                        </button>
                                        <button
                                            onClick={() => setPrompt(winterLuxuryFashionPrompt)}
                                            className="w-full bg-neutral-800/80 hover:bg-neutral-700/80 border border-neutral-600/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <ShoppingBag className="mr-2 text-amber-200" />
                                            [겨울 럭셔리 패션: 샤넬 스타일 & 눈 내리는 거리]
                                        </button>
                                        <button
                                            onClick={() => setPrompt(goldenHourBeachPrompt)}
                                            className="w-full bg-amber-600/80 hover:bg-amber-500/80 border border-amber-400/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Sunset className="mr-2 text-orange-200" />
                                            [골든 아워: 해변의 연인 & 모닥불]
                                        </button>
                                        <button
                                            onClick={() => setPrompt(christmasLivingRoomPrompt)}
                                            className="w-full bg-red-800/80 hover:bg-red-700/80 border border-green-700/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Tv className="mr-2 text-green-300" />
                                            [크리스마스 거실: TV 속 디즈니 세상]
                                        </button>
                                        <button
                                            onClick={() => setPrompt(emotionalIdolBedroomPrompt)}
                                            className="w-full bg-pink-400/80 hover:bg-pink-300/80 border border-pink-200/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Heart className="mr-2 text-white" />
                                            [감성 아이돌: 내츄럴 침실 화보]
                                        </button>
                                        <button
                                            onClick={() => setPrompt(survivorWhiteShirtPrompt)}
                                            className="w-full bg-stone-700/80 hover:bg-stone-600/80 border border-stone-500/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Shield className="mr-2 text-orange-300" />
                                            [생존자: 흰 티셔츠 여전사]
                                        </button>
                                        <button
                                            onClick={() => setPrompt(survivorVehiclePrompt)}
                                            className="w-full bg-stone-800/80 hover:bg-stone-700/80 border border-stone-600/50 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <Truck className="mr-2 text-yellow-500" />
                                            [생존자: 기갑 차량 질주]
                                        </button>
                                        <button
                                            onClick={() => setPrompt(survivorScoutCapPrompt)}
                                            className="w-full bg-stone-600/80 hover:bg-stone-500/80 border border-stone-400/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-md transition-all transform hover:scale-105"
                                        >
                                            <MapIcon className="mr-2 text-green-300" />
                                            [생존자: 스카우트 모자 소녀]
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Character Collection Accordion - Separate from Signature Collections */}
                        {characterCollection.length > 0 && (
                            <div className="mb-3 bg-gray-800/50 rounded-lg border border-white/10 overflow-hidden">
                                <button
                                    onClick={() => setIsCharacterCollectionOpen(!isCharacterCollectionOpen)}
                                    className="w-full flex justify-between items-center p-3 text-md font-bold text-pink-300 hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center">
                                        <User className="mr-2" size={18} />
                                        <span>나만의 캐릭터 컬렉션</span>
                                    </div>
                                    {isCharacterCollectionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>

                                {isCharacterCollectionOpen && (
                                    <div className="p-3 border-t border-white/10">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {characterCollection.map(character => (
                                                <div
                                                    key={character.id}
                                                    className="relative group bg-gradient-to-br from-pink-900/30 to-purple-900/30 border border-pink-500/30 rounded-lg p-2 hover:border-pink-400/50 transition-all"
                                                >
                                                    <button
                                                        onClick={() => loadCharacter(character)}
                                                        className="w-full text-left"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {characterImages[character.id] ? (
                                                                <img
                                                                    src={characterImages[character.id]}
                                                                    alt={character.name}
                                                                    className="w-12 h-12 rounded object-cover border border-pink-500/30"
                                                                />
                                                            ) : (
                                                                <div className="w-12 h-12 rounded bg-pink-900/50 border border-pink-500/30 flex items-center justify-center">
                                                                    <User className="text-pink-300" size={24} />
                                                                </div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-bold text-pink-200 truncate">{character.name}</p>
                                                                <p className="text-xs text-gray-400 truncate">{character.description.substring(0, 40)}...</p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                    <button
                                                        onClick={() => deleteCharacter(character.id)}
                                                        className="absolute top-1 right-1 p-1 bg-red-600/80 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="삭제"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end mb-2">
                            <button
                                onClick={handleEnhance}
                                disabled={isEnhancing || !prompt.trim()}
                                className={`text-xs flex items-center gap-1 px-3 py-1.5 rounded-full font-bold transition-all ${isEnhancing ? 'bg-purple-900/50 text-purple-300' : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg hover:scale-105'}`}
                            >
                                {isEnhancing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                {isEnhancing ? '후처리 중...' : '✨ 후처리 적용 (Enhance)'}
                            </button>
                        </div>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe your imagination... (e.g. A futuristic city with flying cars, cyberpunk style)"
                            className="w-full h-32 bg-gray-800 text-white rounded-lg p-3 focus:ring-2 focus:ring-purple-500 border border-gray-700 resize-none text-sm mb-3"
                        />

                        {/* Reference Image Uploads */}
                        {['Reference', 'Edit'].includes(mode) && (
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                {mode === 'Reference' && (
                                    <>
                                        <div className="bg-gray-800 p-2 rounded-lg border border-gray-700">
                                            <label className="block text-xs font-bold text-gray-400 mb-1">Character Ref (First)</label>
                                            <input type="file" ref={characterRefInputRef} onChange={(e) => handleImageUpload(e.target.files?.[0] || null, 'character')} className="hidden" accept="image/*" />
                                            <div
                                                onClick={() => characterRefInputRef.current?.click()}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => processDrop(e, 'character')}
                                                className="h-20 bg-gray-700 rounded flex items-center justify-center cursor-pointer hover:bg-gray-600 overflow-hidden relative"
                                            >
                                                {characterReference ? <img src={characterReference.url} alt="Char Ref" className="w-full h-full object-cover" /> : <div className="text-center"><Upload size={16} className="mx-auto mb-1" /><span className="text-xs text-gray-400">Upload</span></div>}
                                            </div>
                                            {characterReference && <button onClick={(e) => { e.stopPropagation(); setCharacterReference(null); }} className="text-xs text-red-400 mt-1 hover:text-red-300 w-full text-center">Remove</button>}
                                        </div>
                                        <div className="bg-gray-800 p-2 rounded-lg border border-gray-700">
                                            <label className="block text-xs font-bold text-gray-400 mb-1">Background Ref (Second)</label>
                                            <input type="file" ref={backgroundRefInputRef} onChange={(e) => handleImageUpload(e.target.files?.[0] || null, 'background')} className="hidden" accept="image/*" />
                                            <div
                                                onClick={() => backgroundRefInputRef.current?.click()}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => processDrop(e, 'background')}
                                                className="h-20 bg-gray-700 rounded flex items-center justify-center cursor-pointer hover:bg-gray-600 overflow-hidden relative"
                                            >
                                                {backgroundReference ? <img src={backgroundReference.url} alt="Bg Ref" className="w-full h-full object-cover" /> : <div className="text-center"><Upload size={16} className="mx-auto mb-1" /><span className="text-xs text-gray-400">Upload</span></div>}
                                            </div>
                                            {backgroundReference && <button onClick={(e) => { e.stopPropagation(); setBackgroundReference(null); }} className="text-xs text-red-400 mt-1 hover:text-red-300 w-full text-center">Remove</button>}
                                        </div>
                                        <div className="col-span-2 bg-gray-800 p-2 rounded-lg border border-gray-700">
                                            <label className="block text-xs font-bold text-gray-400 mb-1">Template Ref (Third/Layout)</label>
                                            <input type="file" ref={templateRefInputRef} onChange={(e) => handleImageUpload(e.target.files?.[0] || null, 'template')} className="hidden" accept="image/*" />
                                            <div
                                                onClick={() => templateRefInputRef.current?.click()}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => processDrop(e, 'template')}
                                                className="h-20 bg-gray-700 rounded flex items-center justify-center cursor-pointer hover:bg-gray-600 overflow-hidden relative"
                                            >
                                                {templateReference ? <img src={templateReference.url} alt="Template Ref" className="w-full h-full object-cover" /> : <div className="text-center"><Upload size={16} className="mx-auto mb-1" /><span className="text-xs text-gray-400">Upload</span></div>}
                                            </div>
                                            {templateReference && <button onClick={(e) => { e.stopPropagation(); setTemplateReference(null); }} className="text-xs text-red-400 mt-1 hover:text-red-300 w-full text-center">Remove</button>}
                                        </div>
                                    </>
                                )}
                                {mode === 'Edit' && (
                                    <div className="col-span-2 bg-gray-800 p-2 rounded-lg border border-gray-700">
                                        <label className="block text-xs font-bold text-gray-400 mb-1">Target Image (For Edit)</label>
                                        <input type="file" ref={fileInputRef} onChange={(e) => handleImageUpload(e.target.files?.[0] || null, 'original')} className="hidden" accept="image/*" />
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => processDrop(e, 'original')}
                                            className="h-32 bg-gray-700 rounded flex items-center justify-center cursor-pointer hover:bg-gray-600 overflow-hidden relative"
                                        >
                                            {originalImage ? <img src={originalImage.url} alt="Original" className="w-full h-full object-contain" /> : <div className="text-center"><Upload size={24} className="mx-auto mb-2 text-gray-400" /><span className="text-sm text-gray-400">Click to Upload Image to Edit</span></div>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}


                        {/* Settings Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-gray-800 p-2 rounded border border-gray-700">
                                <label className="block text-xs text-gray-400 mb-1">화면 비율 (Aspect Ratio)</label>
                                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-gray-700 text-white rounded p-1 text-sm border-none focus:ring-1 focus:ring-purple-500">
                                    <option value="1:1">1:1 (Square)</option>
                                    <option value="16:9">16:9 (Landscape)</option>
                                    <option value="9:16">9:16 (Portrait)</option>
                                    <option value="4:3">4:3 (Classic)</option>
                                    <option value="3:4">3:4 (Classic Portrait)</option>
                                    <option value="2.35:1">2.35:1 (Cinema)</option>
                                </select>
                            </div>
                            <div className="bg-gray-800 p-2 rounded border border-gray-700">
                                <label className="block text-xs text-gray-400 mb-1 flex items-center justify-between">
                                    모델 (Model)
                                    <button
                                        onClick={handleRefreshModels}
                                        disabled={isModelLoading}
                                        className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
                                        title="모델 목록 새로고침"
                                    >
                                        <RefreshCw className={`w-3 h-3 ${isModelLoading ? 'animate-spin' : ''}`} />
                                    </button>
                                </label>
                                <select
                                    value={imageModel}
                                    onChange={(e) => setImageModel(e.target.value)}
                                    className="w-full bg-gray-700 text-white rounded p-1 text-sm border-none focus:ring-1 focus:ring-purple-500"
                                >
                                    {availableModels.length > 0 ? (
                                        availableModels.map(model => (
                                            <option key={model} value={model}>{model}</option>
                                        ))
                                    ) : (
                                        <>
                                            <option value="imagen-4.0-generate-001">Imagen 4.0 (Default)</option>
                                            <option value="imagen-3.0-generate-001">Imagen 3.0</option>
                                            <option value="imagen-4.0-fast-generate-001">Imagen 4.0 Fast</option>
                                        </>
                                    )}
                                </select>
                            </div>
                            {/* Mode Specific Settings */}
                            {mode === 'Edit' && (
                                <div className="col-span-2 bg-gray-800 p-2 rounded border border-gray-700 flex items-center justify-between">
                                    <label className="text-xs text-gray-400 flex items-center">
                                        <span className={`w-3 h-3 rounded-full mr-2 ${isInpaintMode ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                                        인페인트 모드 (Inpaint Mode - Eraser)
                                    </label>
                                    <button onClick={() => { setIsInpaintMode(!isInpaintMode); if (!isInpaintMode && originalImage) setShowMoveObjectGuide(true); }} className={`px-3 py-1 text-xs rounded font-bold transition-colors ${isInpaintMode ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                                        {isInpaintMode ? '켜짐' : '꺼짐'}
                                    </button>
                                </div>
                            )}
                            {isInpaintMode && (
                                <div className="col-span-2 bg-gray-800 p-2 rounded border border-gray-700">
                                    <label className="block text-xs text-gray-400 mb-1">Brush Size: {brushSize}px</label>
                                    <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full accent-purple-500" />
                                </div>
                            )}

                            <div className="col-span-2 flex flex-wrap gap-2">
                                <button onClick={() => setNoGuard(!noGuard)} className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${noGuard ? 'bg-red-900/50 border-red-500 text-red-200' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>검열 해제 </button>
                                <button onClick={() => setEnhanceBackground(!enhanceBackground)} className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${enhanceBackground ? 'bg-blue-900/50 border-blue-500 text-blue-200' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>배경 강화 </button>
                                <button onClick={() => setRemoveBackground(!removeBackground)} className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${removeBackground ? 'bg-green-900/50 border-green-500 text-green-200' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>배경 제거 </button>
                                <button onClick={() => setIsProMode(!isProMode)} className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${isProMode ? 'bg-purple-900/50 border-purple-500 text-purple-200' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>프로 모드 </button>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={isLoading || !prompt.trim()}
                            className={`w-full py-4 rounded-lg font-black text-lg uppercase tracking-wider shadow-lg transform active:scale-95 transition-all text-white
                        ${isLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border border-purple-400/30'}
                    `}
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center"><Loader2 className="animate-spin mr-2" /> Creating Masterpiece...</span>
                            ) : (
                                <span className="font-bold">
                                    {mode === 'Edit' && isInpaintMode ? '인페인트 생성 (Generate Inpaint)' : '이미지 생성 (Generate Image)'}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Cheat Keys - Now inside the scrollable container */}
                    <div className="pb-8">
                        <div className="bg-gray-900/50 rounded-lg border border-white/10 flex flex-col overflow-hidden">
                            <div className="p-3 bg-gray-800/50 border-b border-white/5 flex justify-between items-center cursor-pointer" onClick={() => setIsCheatKeysOpen(!isCheatKeysOpen)}>
                                <h3 className="font-bold text-gray-200 flex items-center text-sm"><Keyboard className="mr-2" size={16} /> 치트키 (Cheat Keys)</h3>
                                {isCheatKeysOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                            {isCheatKeysOpen && (
                                <div className="p-3">
                                    <input type="text" placeholder="Search keys..." value={cheatKeySearch} onChange={(e) => setCheatKeySearch(e.target.value)} className="w-full bg-gray-800 text-white text-xs rounded p-2 mb-2 border border-gray-700" />
                                    <div className="space-y-2">
                                        {categoryOrder
                                            .filter(category => filteredCheatKeys[category])
                                            .map(category => {
                                                const keys = filteredCheatKeys[category];
                                                return (
                                                    <div key={category} id={`category-${category}`} className="border border-gray-700 rounded-lg overflow-hidden">
                                                        <button
                                                            onClick={() => {
                                                                setOpenCategories({ [category]: !openCategories[category] });
                                                                setCategoryOrder(prev => {
                                                                    const filtered = prev.filter(cat => cat !== category);
                                                                    return [category, ...filtered];
                                                                });
                                                            }}
                                                            className="w-full flex justify-between items-center p-2 bg-gray-800/50 hover:bg-gradient-to-r hover:from-purple-500/40 hover:to-pink-500/40 transition-all duration-200"
                                                        >
                                                            <h4 className="text-xs font-bold text-gray-100 uppercase tracking-widest">{category}</h4>
                                                            {openCategories[category] ? <ChevronUp size={14} className="text-purple-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                                                        </button>
                                                        {openCategories[category] && (
                                                            <div className="p-2 bg-gray-900/30">
                                                                {category.includes('Fashion') ? (
                                                                    <div className="space-y-2">
                                                                        <div className="flex flex-wrap gap-2">
                                                                            <button onClick={() => { setFashionOpen(!fashionOpen); setWardrobeOpen({ tops: false, bottoms: false, dresses: false }); }} className="flex items-center gap-1 px-2 py-1 text-xs text-pink-400 hover:text-pink-300 bg-gray-800/50 rounded border border-gray-700">
                                                                                <span>기존 패션</span>
                                                                                {fashionOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                                            </button>
                                                                            <button onClick={() => { setFashionOpen(false); setWardrobeOpen({ tops: !wardrobeOpen.tops, bottoms: false, dresses: false }); }} className="flex items-center gap-1 px-2 py-1 text-xs text-pink-400 hover:text-pink-300 bg-gray-800/50 rounded border border-gray-700">
                                                                                <span>상의</span>
                                                                                {wardrobeOpen.tops ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                                            </button>
                                                                            <button onClick={() => { setFashionOpen(false); setWardrobeOpen({ tops: false, bottoms: !wardrobeOpen.bottoms, dresses: false }); }} className="flex items-center gap-1 px-2 py-1 text-xs text-pink-400 hover:text-pink-300 bg-gray-800/50 rounded border border-gray-700">
                                                                                <span>하의</span>
                                                                                {wardrobeOpen.bottoms ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                                            </button>
                                                                            <button onClick={() => { setFashionOpen(false); setWardrobeOpen({ tops: false, bottoms: false, dresses: !wardrobeOpen.dresses }); }} className="flex items-center gap-1 px-2 py-1 text-xs text-pink-400 hover:text-pink-300 bg-gray-800/50 rounded border border-gray-700">
                                                                                <span>원피스</span>
                                                                                {wardrobeOpen.dresses ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                                            </button>
                                                                        </div>
                                                                        {fashionOpen && <div className="flex flex-wrap gap-1.5">{keys.map((key) => <button key={key.id} onClick={() => toggleCheatKey(key.id)} className={`px-3 py-2 rounded text-xs font-medium border transition-all ${activeCheatKeys.includes(key.id) ? 'bg-purple-600 border-purple-400 text-white shadow-md' : 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-purple-500/30 hover:text-white hover:border-purple-400'}`} title={key.description}>{key.label}</button>)}</div>}
                                                                        {wardrobeOpen.tops && <div className="flex flex-wrap gap-1.5">{LUXURY_WARDROBE.tops.map((item, idx) => <button key={`top-${idx}`} onClick={() => { const isActive = prompt.includes(item); setPrompt(p => isActive ? p.replace(item, '').trim() : `${p} ${item}`.trim()); }} className={`px-3 py-2 rounded text-xs font-medium border transition-all ${prompt.includes(item) ? 'bg-purple-600 border-purple-400 text-white shadow-md' : 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-pink-500/30 hover:text-white hover:border-pink-400'}`} title={item}>{LUXURY_WARDROBE_KR.tops[idx]}</button>)}</div>}
                                                                        {wardrobeOpen.bottoms && <div className="flex flex-wrap gap-1.5">{LUXURY_WARDROBE.bottoms.map((item, idx) => <button key={`bottom-${idx}`} onClick={() => { const isActive = prompt.includes(item); setPrompt(p => isActive ? p.replace(item, '').trim() : `${p} ${item}`.trim()); }} className={`px-3 py-2 rounded text-xs font-medium border transition-all ${prompt.includes(item) ? 'bg-purple-600 border-purple-400 text-white shadow-md' : 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-blue-500/30 hover:text-white hover:border-blue-400'}`} title={item}>{LUXURY_WARDROBE_KR.bottoms[idx]}</button>)}</div>}
                                                                        {wardrobeOpen.dresses && <div className="flex flex-wrap gap-1.5">{LUXURY_WARDROBE.dresses.map((item, idx) => <button key={`dress-${idx}`} onClick={() => { const isActive = prompt.includes(item); setPrompt(p => isActive ? p.replace(item, '').trim() : `${p} ${item}`.trim()); }} className={`px-3 py-2 rounded text-xs font-medium border transition-all ${prompt.includes(item) ? 'bg-purple-600 border-purple-400 text-white shadow-md' : 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-rose-500/30 hover:text-white hover:border-rose-400'}`} title={item}>{LUXURY_WARDROBE_KR.dresses[idx]}</button>)}</div>}
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {keys.map((key) => (
                                                                            <button
                                                                                key={key.id}
                                                                                onClick={() => toggleCheatKey(key.id)}
                                                                                className={`px-3 py-2 rounded text-xs font-medium border transition-all ${activeCheatKeys.includes(key.id) ? 'bg-purple-600 border-purple-400 text-white shadow-md' : 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-indigo-500/30 hover:text-white hover:border-indigo-400'}`}
                                                                                title={key.description}
                                                                            >
                                                                                {key.label}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* History Sidebar is handled by ImageHistorySidebar component, but we keep the structure clean here */}
                </div>
            </div>

            {/* Right Panel - Display Canvas */}
            < div className="w-[55%] bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden" >
                <div className="relative max-w-full max-h-full flex items-center justify-center shadow-2xl rounded-lg overflow-hidden border border-gray-800"
                    onDragOver={handleDragOver}
                    onDrop={(e) => processDrop(e, 'original')}
                    style={{
                        aspectRatio: aspectRatio.replace(':', '/'),
                        width: aspectRatio === '16:9' || aspectRatio === '2.35:1' ? '100%' : 'auto',
                        height: aspectRatio === '9:16' || aspectRatio === '3:4' ? '100%' : 'auto'
                    }}
                >
                    {(() => {
                        const displayImage = generatedImage || ((mode === 'Edit' || mode === 'Variations' || mode === 'Upscale') ? originalImage : null);

                        return (
                            <div className="relative w-full h-full flex items-center justify-center bg-gray-900 group">
                                {displayImage ? (
                                    <>
                                        <img
                                            src={displayImage.url}
                                            alt="Display"
                                            className="w-full h-full object-contain cursor-pointer"
                                            onClick={() => setLightboxImageUrl(displayImage.url)}
                                            style={{ opacity: isInpaintMode ? 0.8 : 1 }}
                                        />
                                        {!isInpaintMode && (
                                            <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                <button
                                                    className="p-2 bg-purple-600/80 rounded-full text-white hover:bg-purple-500 backdrop-blur-sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Handle Save Character from Main View
                                                        const itemToSave: ImageHistoryItem = {
                                                            id: displayImage.id,
                                                            prompt: prompt || 'Uploaded Image', // Use current prompt or default
                                                            generatedImageId: displayImage.id, // Use the image ID (works for both generated and uploaded as they are blobs)
                                                            settings: {
                                                                mode: mode,
                                                                aspectRatio: aspectRatio,
                                                                activeCheatKeys: activeCheatKeys,
                                                                noGuard: noGuard,
                                                                enhanceBackground: enhanceBackground,
                                                                removeBackground: removeBackground,
                                                                creativity: 0
                                                            }
                                                        };
                                                        handleSaveCharacter(itemToSave, e);
                                                    }}
                                                    title="Save as Character"
                                                >
                                                    <User size={20} />
                                                </button>
                                                <a href={displayImage.url} download={`image_${displayImage.id}.png`} className="p-2 bg-black/60 rounded-full text-white hover:bg-black/80 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}><Download size={20} /></a>
                                                <button className="p-2 bg-black/60 rounded-full text-white hover:bg-black/80 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setLightboxImageUrl(displayImage.url); }}><Maximize size={20} /></button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center text-gray-500 flex flex-col items-center justify-center">
                                        <p className="mb-2">Generated Image will appear here</p>
                                        {mode === 'Edit' && !originalImage && <p className="text-xs text-gray-600">(Upload an image to Edit)</p>}
                                    </div>
                                )}

                                {/* Inpaint Canvas Layer - Always rendered if in Edit mode, overlaying whatever is below */}
                                <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${mode === 'Edit' && isInpaintMode ? 'pointer-events-auto z-20' : 'z-0'}`}>
                                    {/* Canvas container needs to match image aspect ratio/size exactly. 
                                        For simplicity in this CSS grid, we let it fill the parent, 
                                        but drawing coordinates might need adjustment if object-contain leaves gaps.
                                        For now, we rely on the centered layout. 
                                     */}
                                    <div className={`relative w-full h-full ${mode === 'Edit' && isInpaintMode ? 'block' : 'hidden'}`}>
                                        <canvas ref={displayCanvasRef} className="absolute inset-0 m-auto object-contain pointer-events-none" />
                                        <canvas
                                            ref={maskCanvasRef}
                                            onMouseDown={startDrawing}
                                            onMouseMove={draw}
                                            onMouseUp={stopDrawing}
                                            onMouseLeave={stopDrawing}
                                            className="absolute inset-0 m-auto object-contain cursor-crosshair opacity-70"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {isLoading && (
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20">
                            <Loader2 className="animate-spin mb-4 text-purple-500" size={48} />
                            <p className="font-bold text-lg animate-pulse">Creating Masterpiece...</p>
                        </div>
                    )}
                </div>

                <ImageHistorySidebar
                    isOpen={isHistoryOpen}
                    setIsOpen={setIsHistoryOpen}
                    historyItems={favoritesOnly ? historyItems.filter(item => item.favorite) : historyItems}
                    historyImages={historyImages}
                    onSelect={loadFromHistory}
                    onDelete={deleteFromHistory}
                    onToggleFavorite={toggleFavorite}
                    onEdit={(item, e) => {
                        e.stopPropagation();
                        // Persist selection for Master Studio load
                        setAppStorageValue('imageStudio_load_from_history', item);
                        setIsHistoryOpen(false);
                        setNotification({ message: '이미지 스튜디오에서 편집을 계속하세요. (히스토리에서 선택됨)', type: 'success' });
                    }}
                    onSaveCharacter={handleSaveCharacter}
                />

                {/* Notification Toast */}
                {notification && (
                    <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-2xl z-50 transition-all duration-300 ${notification.type === 'success' ? 'bg-green-600/90 text-white' : 'bg-red-600/90 text-white'}`}>
                        <div className="flex items-center space-x-2">
                            {notification.type === 'success' ? <span className="text-xl">✓</span> : <span className="text-xl">⚠</span>}
                            <span className="font-bold">{notification.message}</span>
                        </div>
                    </div>
                )}

                {/* Save Character Modal */}
                <SaveCharacterModal
                    isOpen={isSaveCharacterModalOpen}
                    onClose={() => {
                        setIsSaveCharacterModalOpen(false);
                        setSelectedItemForCharacter(null);
                    }}
                    onSave={handleSaveCharacterConfirm}
                    initialPrompt={selectedItemForCharacter?.prompt || ''}
                />
            </div >
        </div >
    );
};

export default ImageStudio;
// PART8
