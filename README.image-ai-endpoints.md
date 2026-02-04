# Image Controller Endpoints & AI Models

This table lists each endpoint in `image.controller.ts` and the AI model (if any) used in its implementation.

| Endpoint                                 | Method | AI Model / Provider                |
|------------------------------------------|--------|------------------------------------|
| /gen-img-with-selected-background        | POST   | OpenAI (gpt-image-1, composite)    |
| /gen-img-with-new-background             | POST   | Stability AI (stable-diffusion-xl) |
| /gen-resize-img                          | POST   | None (Sharp image processing)      |
| /blur-image-region                       | POST   | None (Sharp image processing)      |
| /get-image                               | GET    | None                              |
| /get-last-background-versions/:imageId    | GET    | None                              |
| /gen-img-with-new-dimension              | POST   | Custom (genImgWithNewDimensionFn)  |
| /gen-inhanced-quality-img                | POST   | Custom (genInhancedQualityImgFn)   |
| /gen-merge-logo-to-img                   | POST   | Custom (genMergeLogoToImgFn)       |
| /extract-text-from-img                   | POST   | Custom (extractTextFromImgFn)      |
| /recognize-items-in-img                  | POST   | Custom (recognizeItemsInImgFn)     |
| /getall                                  | GET    | None                              |
| /delete/:imageId                         | DELETE | None                              |
| /gen-img-without-background              | POST   | Custom (removeBackgroundFromImageBase64) |
| /gen-suitable-background                 | POST   | HuggingFace/SDXL (genSuitableBackgroundAI) |
| /gen-change-image-style                  | POST   | Custom (genChangeImageStyleFn)     |

- "Custom" means a project-specific AI or utility function is used.
- "None" means no AI model is used, only standard image processing or database logic.
- For more details, see the corresponding service method in `image.service.ts`.
