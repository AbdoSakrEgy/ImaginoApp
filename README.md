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

## POST `/image/gen-suitable-background`

- **Purpose**: Pre-generate background concepts that match a transparent product cutout without compositing the product back in. The service reuses the exact AI pipeline from `/gen-img-with-new-background` (vision analysis + Stability) but uploads the raw background only asset, marks it with `isBackgroundOnly = true`, and leaves it ready for later manual pairing.
- **Payload style**: JSON body identical to `/gen-img-with-new-background`. At minimum supply `imageId`; optional creative controls (`prompt`, `negativePrompt`, `stylePreset`, `seed`, `width`, `height`) behave the same way.

### Response shape

```jsonc
{
  "message": "Background generated successfully",
  "status": 200,
  "result": {
    "sourceImage": {
      /* sanitized doc for the transparent product */
    },
    "backgroundImage": {
      /* stored ImageModel doc with isBackgroundOnly=true */
    },
  },
}
```

### Implementation notes

- Background prompts, negative prompts, placement hints, and size guidance all flow through the OpenAI stage-one analysis just like the full composite endpoint.
- The stage-one prompts now explicitly reserve an empty staging pocket so each generated background clearly leaves room for the foreground product.
- Backgrounds are uploaded directly from buffers to Cloudinary under `${PROJECT_FOLDER || "DefaultProjectFolder"}/${userId}/suitable-backgrounds` to avoid filesystem churn.
- Every generated asset is tagged with `genSuitableBackground`, `background-only`, and `stability-bg`, plus any detected theme/style preset so clients can filter by context.
- AI metadata (`aiEdits[0].parameters`) includes `backgroundOnly: true`, prompt provenance, placement hints, and snapshotted prompt details for auditing.

### Typical errors

- Same as `/gen-img-with-new-background` (auth failure, invalid `imageId`, Stability API issues).

## POST `/image/gen-img-with-selected-background`

- **Purpose**: Take an existing transparent product (typically produced by `/gen-img-without-background`) and composite it onto a background chosen by the user. The background can be referenced by `backgroundImageId` (e.g., something previously generated by `/gen-suitable-background`) or uploaded as a brand-new file in the same request.
- **Payload style**: `multipart/form-data` when uploading a background file; otherwise JSON. Always include `productImageId` in the body.

### Body / form fields

| Field               | Type | Required | Notes                                                                                                                           |
| ------------------- | ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `productImageId`    | text | yes      | `_id` of the transparent product that belongs to the caller.                                                                    |
| `backgroundImageId` | text | optional | Reference to a stored background owned by the caller. Required when no file is uploaded.                                        |
| `backgroundImage`   | file | optional | Raw background upload (`.jpg`, `.png`, etc.). Required when `backgroundImageId` is omitted. Use the `backgroundImage` form key. |

### Behavior overview

1. Validates ownership of the transparent asset (and optional background image).
2. Downloads the transparent PNG and the selected background (via Cloudinary or the uploaded file).
3. Resizes the product layer just like `/gen-img-with-new-background`, then reuses the same `calculateProductPlacement` heuristics to ground the product in the scene.
4. Composites the two buffers with `sharp`, uploads the merged result to Cloudinary under `${PROJECT_FOLDER || "DefaultProjectFolder"}/${userId}/selected-backgrounds`, and registers a new `ImageModel` child of the transparent asset.

### Response shape

```jsonc
{
  "message": "Background applied successfully",
  "status": 200,
  "result": {
    "transparentImage": {
      /* parent doc */
    },
    "backgroundImage": {
      /* only when a stored image id was used */
    },
    "generatedImage": {
      /* merged composite */
    },
  },
}
```

### Typical errors

- `400` if `productImageId` is invalid or neither `backgroundImageId` nor `backgroundImage` are supplied.
- `404` if the referenced product/background images do not belong to the caller.
- `401` for missing/invalid auth.

## GET `/image/backgrounds/:imageId`

- **Purpose**: Fetch every `isBackgroundOnly = true` asset linked to a specific transparent product image. Useful for surfacing past `/gen-suitable-background` runs before choosing one for `/gen-img-with-selected-background`.
- **Auth**: Same as other image routes; callers only see their own assets.

### Query params

| Param  | Type   | Required | Notes                              |
| ------ | ------ | -------- | ---------------------------------- |
| `page` | number | optional | Defaults to `1`. Must be positive. |
| `size` | number | optional | Defaults to `20`, capped at `100`. |

### Response shape

```jsonc
{
  "message": "Backgrounds fetched successfully",
  "status": 200,
  "result": {
    "parentImage": {
      /* transparent product */
    },
    "backgrounds": [
      {
        /* serialized background-only doc */
      },
    ],
    "totalCount": 8,
    "page": 1,
    "size": 20,
  },
}
```

### Typical errors

- `400` when `imageId` is missing or invalid.
- `404` when the transparent image does not belong to the caller.
- `401` when auth is missing.

## POST `/image/blur-image-region`

- **Purpose**: Blur a rectangular region inside an image (useful for anonymizing faces, license plates, or any sensitive zone). You can either reference an existing stored image via `imageId` or upload a brand new file in the same request.
- **Payload style**: `multipart/form-data` when including a file (`image` field). When omitting the file, send a JSON body with the numeric coordinates.

### Body / form fields

| Field        | Type   | Required    | Notes                                                                            |
| ------------ | ------ | ----------- | -------------------------------------------------------------------------------- |
| `imageId`    | text   | conditional | Required when no file is uploaded. Must reference an image owned by the caller.  |
| `image`      | file   | conditional | Required when `imageId` is omitted. Any image format accepted by `sharp`.        |
| `x`          | number | yes         | Left coordinate (pixels) of the region to blur. Must be within the image bounds. |
| `y`          | number | yes         | Top coordinate (pixels) of the region to blur.                                   |
| `width`      | number | yes         | Width of the blur box in pixels.                                                 |
| `height`     | number | yes         | Height of the blur box in pixels.                                                |
| `blurRadius` | number | optional    | Blur strength (defaults to `25`, clamped between `1` and `200`).                 |

### Behavior overview

1. Validates ownership (or uploads the provided file as a brand new original image owned by the caller).
2. Uses `sharp` to generate a blurred copy of the source image, extracts just the requested rectangle, and composites that blurred patch back on top of the original pixels.
3. Stores the blurred result in Cloudinary under `${PROJECT_FOLDER || "DefaultProjectFolder"}/${userId}/blurred-regions`, links it as a child of the original image, and records the blur region metadata in `aiEdits`.

### Response shape

```jsonc
{
  "message": "Image blurred successfully",
  "status": 200,
  "result": {
    "originalImage": {
      /* source image doc (null only in extreme edge cases) */
    },
    "blurredImage": {
      /* new blurred child document */
    },
  },
}
```

### Typical errors

- `400` when coordinates are missing/invalid or fall outside the image bounds.
- `400` when neither `imageId` nor `image` are supplied.
- `404` if the referenced `imageId` does not belong to the caller.
- `401` when auth is missing.

## POST `/image/gen-img-with-new-background`

- **Purpose**: Compose a lifestyle-ready asset by taking a previously uploaded transparent product image (typically produced via `/gen-img-without-background`) and asking Stability AI to hallucinate a new background, then blending the two layers together.
- **Payload style**: JSON body (no file upload). Pass the product image reference plus optional creative controls.

### JSON body fields

| Field            | Type   | Required | Notes                                                                                                                                                                                                                                                                                                           |
| ---------------- | ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `imageId`        | string | yes      | `_id` of the transparent image owned by the user. Must exist and not be soft-deleted.                                                                                                                                                                                                                           |
| `prompt`         | string | optional | Positive instruction for the AI background (e.g., "modern marble kitchen countertop, morning sun"). When omitted the service auto-writes a scene prompt by first running the transparent product image through an OpenAI vision model to describe the object, then blending that analysis with stored metadata. |
| `negativePrompt` | string | optional | Extra guidance for what to avoid (e.g., "no text, no people"). Defaults to a theme-specific negative prompt when not provided.                                                                                                                                                                                  |
| `stylePreset`    | string | optional | Stability style preset such as `photographic`, `digital-art`, `anime`, etc.                                                                                                                                                                                                                                     |
| `seed`           | number | optional | Deterministic seed for reproducible generations.                                                                                                                                                                                                                                                                |
| `width`          | number | optional | Target canvas width in px (defaults to the source image width or 1024).                                                                                                                                                                                                                                         |
| `height`         | number | optional | Target canvas height in px (defaults to the source image height or the width fallback).                                                                                                                                                                                                                         |

### Pipeline summary

1. Validates ownership of `imageId`.
2. Downloads the transparent PNG from Cloudinary.
3. Runs a "stage-one" vision analysis via OpenAI (`gpt-4o-mini` by default) that inspects the transparent PNG and produces a JSON payload containing: a richly detailed positive prompt, an optional negative prompt, product attributes, background scene ideas, **and explicit hints about how large the product appears plus where it sits in-frame**. Those placement hints are appended to the Stability prompt so the synthesized scene respects the product's perceived scale, and every prompt reiterates that there must be an empty staging pocket left open for the real product.
4. Calls the Stability AI Replace Background endpoint (`/v2beta/stable-image/edit/replace-background`) with the product layer plus the combined prompt metadata to synthesize a new backdrop (automatically falling back to a text-to-image generation when the replace endpoint is unavailable in the current region/plan). When falling back, requested `width`/`height` are snapped to the SDXL-approved resolutions to avoid `invalid_sdxl_v1_dimensions` errors.
5. Uses `sharp` to composite the original product atop the generated background. The compositor auto-detects product themes (vehicles, beauty, fashion, etc.) and repositions/resizes the foreground to a grounded spot when appropriate (e.g., cars near the horizon line, tall bottles offset from center). All preset themes, prompt templates, and placement heuristics now live in `src/modules/image/background.helpers.ts`, keeping the service lean while preserving the curated fallbacks. When the stage-one vision call returns scale/position hints, those are stored with the AI edit metadata, tagged on the derived asset, and reiterated inside the Stability prompt so background props align with the product's footprint. The finished merge uploads to Cloudinary and is stored as a child image linked to the transparent parent, and metadata captures whether the prompt was user-only, vision-assisted, or fully auto-generated.

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
