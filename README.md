# ImaginoApp Image Endpoints

The following endpoints live under the `/image` router and require a valid bearer token supplied through the standard `Authorization: Bearer <token>` header.

## GET `/image/get-image`

- **Purpose**: Fetch a single image that belongs to the authenticated user, incrementing its `views` count and optionally embedding relational data.
- **Where to put `imageId`**: the service reads `imageId` from, in order of precedence, `/:imageId` params (not currently used), the query string, or the JSON/body payload. Provide it in whichever location fits your client.

### Optional query flags

| Flag              | Type                       | Default | Description                                                                        |
| ----------------- | -------------------------- | ------- | ---------------------------------------------------------------------------------- |
| `includeParent`   | boolean (`true/false/1/0`) | `true`  | Embed the parent/original image document.                                          |
| `includeChildren` | boolean                    | `true`  | Embed derivative versions (children).                                              |
| `includeHistory`  | boolean                    | `false` | Walk the linked list of versions and return the entire edit history (extra query). |

### Success response shape

```jsonc
{
  "message": "Image fetched successfully",
  "status": 200,
  "result": {
    "image": {
      /* sanitized image doc with metadata */
    },
    "parent": {
      /* present when includeParent=true and parent exists */
    },
    "children": [
      /* present when includeChildren=true */
    ],
    "history": [
      /* present when includeHistory=true */
    ],
  },
}
```

### Error cases

- `401` when the requester lacks a valid session.
- `400` if `imageId` is missing/invalid.
- `404` when the image does not exist, is soft-deleted, or belongs to another user.

## POST `/image/gen-resize-img`

- **Purpose**: Generate a resized derivative either from a freshly uploaded image or from an existing asset reference (`imageId`). The service stores both the original (when uploaded) and the resized result on Cloudinary while logging metadata + AI edit provenance in MongoDB.
- **Payload style**: `multipart/form-data` when uploading a new file (`image` field). If you only want to resize an already stored asset, you can omit the file and send JSON/form fields (handled via Express) containing `imageId` plus resize instructions.

### Body / form fields

| Field          | Type                                                   | Required                          | Notes                                                                        |
| -------------- | ------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------- |
| `image`        | file                                                   | required when `imageId` is absent | Source binary to resize. Saved temporarily via multer.                       |
| `imageId`      | string (Mongo ObjectId)                                | required when no file is uploaded | References an existing image that belongs to the user.                       |
| `width`        | number                                                 | one of width/height required      | Positive integer. Accepts numeric strings.                                   |
| `height`       | number                                                 | one of width/height required      | Positive integer. Accepts numeric strings.                                   |
| `fit`          | enum (`cover`, `contain`, `fill`, `inside`, `outside`) | optional, default `inside`        | Passed to `sharp().resize({ fit })`.                                         |
| `position`     | enum (`centre`, `north`, `southeast`, `entropy`, etc.) | optional, default `centre`        | Sharp gravity used when cropping.                                            |
| `background`   | string                                                 | optional                          | Applied when padding transparent areas (e.g., `#ffffff` or `rgba(0,0,0,0)`). |
| `format`       | enum (`jpeg`, `jpg`, `png`, `webp`, `avif`)            | optional                          | Defaults to source format or `png`.                                          |
| `quality`      | number 1–100                                           | optional, default `90`            | Applied when format supports lossy compression.                              |
| `allowUpscale` | boolean                                                | optional, default `false`         | When `false`, prevents `sharp` from enlarging undersized images.             |

### Success response shape

```jsonc
{
  "message": "Image resized successfully",
  "status": 200,
  "result": {
    "originalImage": {
      /* sanitized doc for source image */
    },
    "resizedImage": {
      /* sanitized doc for new derivative */
    },
  },
}
```

### Notes & side effects

- Uploading a new file creates a parent image record tagged with `genResizeImg` + `original` before deriving children.
- Reusing `imageId` skips a new upload; the service downloads the original via its Cloudinary URL before resizing.
- Both code paths clean up temporary files and link parent/child references so future history queries include the resize operation.

### Typical errors

- `401` when auth fails.
- `400` if neither `image` nor `imageId` is provided, dimensions are invalid, or enums contain unsupported values.
- `404` when `imageId` does not resolve to an accessible asset.

## POST `/image/gen-img-without-background`

- **Purpose**: Remove the background from an uploaded image via the `removeBackgroundFromImageBase64` AI helper, then store the transparent PNG in Cloudinary and track it in MongoDB.
- **Payload style**: `multipart/form-data` handled by `multerUpload({ sendedFileDest: "tmp", storeIn: StoreInEnum.disk })` with a single `imageFile` field.

### Body / form fields

| Field       | Type | Required | Notes                                                                                                                  |
| ----------- | ---- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `imageFile` | file | yes      | Original asset whose background should be removed. Maximum size is constrained by multer configuration (disk storage). |

### Processing steps (server side)

1. Validates the authenticated user and uploaded file.
2. Writes the multer buffer to disk, then converts it to base64 for the remove.bg API wrapper.
3. Receives a background-free PNG (base64), saves it temporarily, uploads it to Cloudinary under `${PROJECT_FOLDER || "DefaultProjectFolder"}/${userId}/no-bg`, and persists a new `ImageModel` document tagged with the `remove-background` operation.
4. Cleans up the temporary files, returning metadata to the client.

### Success response shape

```jsonc
{
  "message": "Image uploaded and background removed successfully",
  "status": 200,
  "result": {
    "_id": "<new-image-id>",
    "url": "https://res.cloudinary.com/...",
    "storageKey": "AppName/...",
    "aiEdits": [
      {
        "operation": "remove-background",
        "provider": "custom",
        "timestamp": "2025-12-05T12:34:56.000Z",
      },
    ],
  },
}
```

### Typical errors

- `401` when the requester is not authenticated.
- `400` if no `imageFile` is uploaded.
- `500` when the external background-removal API fails or Cloudinary upload errors out (these bubble up as `ApplicationException`).

## POST `/image/gen-img-with-new-background`

- **Purpose**: Compose a lifestyle-ready asset by taking a previously uploaded transparent product image (typically produced via `/gen-img-without-background`) and asking Stability AI to hallucinate a new background, then blending the two layers together.
- **Payload style**: JSON body (no file upload). Pass the product image reference plus optional creative controls.

### JSON body fields

| Field            | Type   | Required | Notes                                                                                                                                                                                                 |
| ---------------- | ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `imageId`        | string | yes      | `_id` of the transparent image owned by the user. Must exist and not be soft-deleted.                                                                                                                 |
| `prompt`         | string | optional | Positive instruction for the AI background (e.g., "modern marble kitchen countertop, morning sun"). When omitted the service auto-writes a scene prompt derived from the product title/tags/category. |
| `negativePrompt` | string | optional | Extra guidance for what to avoid (e.g., "no text, no people"). Defaults to a theme-specific negative prompt when not provided.                                                                        |
| `stylePreset`    | string | optional | Stability style preset such as `photographic`, `digital-art`, `anime`, etc.                                                                                                                           |
| `seed`           | number | optional | Deterministic seed for reproducible generations.                                                                                                                                                      |
| `width`          | number | optional | Target canvas width in px (defaults to the source image width or 1024).                                                                                                                               |
| `height`         | number | optional | Target canvas height in px (defaults to the source image height or the width fallback).                                                                                                               |

### Pipeline summary

1. Validates ownership of `imageId`.
2. Downloads the transparent PNG from Cloudinary.
3. Calls the Stability AI Replace Background endpoint (`/v2beta/stable-image/edit/replace-background`) with the product layer plus prompt metadata to synthesize a new backdrop (automatically falling back to a text-to-image generation when the replace endpoint is unavailable in the current region/plan). When falling back, requested `width`/`height` are snapped to the SDXL-approved resolutions to avoid `invalid_sdxl_v1_dimensions` errors.
4. Uses `sharp` to composite the original product atop the generated background. The compositor auto-detects product themes (vehicles, beauty, fashion, etc.) and repositions/resizes the foreground to a grounded spot when appropriate (e.g., cars near the horizon line, tall bottles offset from center). The finished merge uploads to Cloudinary and is stored as a child image linked to the transparent parent.

### Success response shape

```jsonc
{
  "message": "Background generated successfully",
  "status": 200,
  "result": {
    "transparentImage": {
      /* parent doc */
    },
    "generatedImage": {
      /* new AI background composite */
    },
  },
}
```

### Typical errors

- `401` when auth is missing.
- `400` for invalid/missing `imageId` or malformed numeric inputs.
- `404` when the referenced image does not belong to the caller.
- `500` when Stability AI returns a non-200 response or Cloudinary upload fails (propagates through the existing error middleware).
