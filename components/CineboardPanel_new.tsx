import React, { useEffect, useMemo, useState } from 'react';
import { Button } from './Button';
import { TargetService } from '../types';
import JSZip from 'jszip';
import { ImageIcon, Sparkles, Loader2, Shield, ShieldOff, RefreshCw, X, Maximize2 } from 'lucide-react';
import { generateImageWithImagen, generateImage, fetchAvailableModels } from './master-studio/services/geminiService';
import { saveImageToDisk } from './master-studio/services/serverService';
import { setBlob } from './master-studio/services/dbService';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import Lightbox from './master-studio/Lightbox';
import { showToast } from './Toast';

// ... existing code ...
