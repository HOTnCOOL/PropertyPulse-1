# Documentation Index

## Current Documentation

- [Model Usage Policy](./MODEL_USAGE_POLICY.md) - Official policy on permitted AI models (Google Gemini only)
- [OCR Model Usage Guide](./OCR_MODEL_USAGE_GUIDE.md) - Detailed guide on using OCR features

## Deprecated Documentation

The following documents are **outdated** and should not be used:

- `10 free LLMs available on Openrau.md` - **DEPRECATED**: Contains references to non-permitted models
- `Google Gemini Flash Lite 2.0 Previe.txt` - **DEPRECATED**: Outdated information about Gemini models
- `Pasted-13-ctures-3-8-13-The-emergence-of-models-like-Llama-3-2-Vision-and-Qwen2-VL-demonstrates-how-1740604042890.txt` - **DEPRECATED**: Contains references to Llama models

## Implementation Status

All necessary changes have been implemented to enforce the use of Google Gemini models exclusively. This includes:

1. ✅ Enhanced API request parameters to prevent model fallbacks
2. ✅ Added strict validation to block responses from non-Gemini models  
3. ✅ Added specific error handling for security policy violations
4. ✅ Updated UI with clear model usage banners
5. ✅ Added comprehensive error feedback on client side

## Version History

- 2025-02-26: Strict Gemini-only policy implemented (v2.0.1)
- 2025-01-15: Initial OCR implementation (v1.0.0)