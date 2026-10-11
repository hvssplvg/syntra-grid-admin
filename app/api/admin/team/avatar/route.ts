import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createHash,
} from "node:crypto";

import {
  requireTeamManager,
} from "@/lib/auth/current-admin";

/* ============================================================================
   CONFIGURATION
============================================================================ */

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/**
 * Maximum allowed image size: 5 MB.
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Supported image formats.
 */
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/**
 * Cloudinary folder for Syntra Grid employee pictures.
 */
const CLOUDINARY_FOLDER =
  "syntragrid/employees";

/**
 * Maximum time allowed for Cloudinary uploads.
 */
const UPLOAD_TIMEOUT = 30_000;

/* ============================================================================
   RESPONSE HELPERS
============================================================================ */

function jsonError(
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    {
      status,
    },
  );
}

/* ============================================================================
   CLOUDINARY CONFIGURATION
============================================================================ */

/**
 * Reads the Cloudinary configuration.
 *
 * Supports:
 *
 * CLOUDINARY_CLOUD_NAME
 *
 * or:
 *
 * NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
 *
 * API credentials must always remain server-side.
 */
function getCloudinaryConfig() {
  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME?.trim() ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();

  const apiKey =
    process.env.CLOUDINARY_API_KEY?.trim();

  const apiSecret =
    process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName) {
    throw new Error(
      "Cloudinary cloud name is missing. Configure CLOUDINARY_CLOUD_NAME or NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME.",
    );
  }

  if (!apiKey) {
    throw new Error(
      "Cloudinary API key is missing. Configure CLOUDINARY_API_KEY.",
    );
  }

  if (!apiSecret) {
    throw new Error(
      "Cloudinary API secret is missing. Configure CLOUDINARY_API_SECRET.",
    );
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
  };
}

/* ============================================================================
   IMAGE VALIDATION
============================================================================ */

/**
 * Detects an image format from its actual file bytes.
 *
 * This prevents someone from renaming an unsupported file
 * to .jpg, .png or .webp to bypass basic validation.
 *
 * This is a format-signature check, not a complete image
 * integrity or malware scan.
 */
function detectImageType(
  bytes: Uint8Array,
): string | null {
  /* ------------------------------------------------------------------------
     JPEG
  ------------------------------------------------------------------------ */

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  /* ------------------------------------------------------------------------
     PNG
  ------------------------------------------------------------------------ */

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a &&
    bytes[8] === 0x0a
  ) {
    return "image/png";
  }

  /* ------------------------------------------------------------------------
     WEBP
  ------------------------------------------------------------------------ */

  if (bytes.length >= 12) {
    const riff =
      String.fromCharCode(
        bytes[0],
        bytes[1],
        bytes[2],
        bytes[3],
      );

    const webp =
      String.fromCharCode(
        bytes[8],
        bytes[9],
        bytes[10],
        bytes[11],
      );

    if (
      riff === "RIFF" &&
      webp === "WEBP"
    ) {
      return "image/webp";
    }
  }

  return null;
}

/* ============================================================================
   CLOUDINARY SIGNATURE
============================================================================ */

/**
 * IMPORTANT:
 *
 * Cloudinary signed uploads do NOT use HMAC-SHA1.
 *
 * The correct signature algorithm is:
 *
 * SHA1(
 *   sorted_parameter_string + API_SECRET
 * )
 *
 * For example:
 *
 * folder=syntragrid/employees&timestamp=1791629405API_SECRET
 *
 * The resulting SHA-1 digest is sent as the upload signature.
 *
 * Cloudinary calculates the same signature independently
 * and compares the values.
 */
function signCloudinaryParameters(
  parameters: Record<string, string>,
  apiSecret: string,
): string {
  /* ------------------------------------------------------------------------
     REMOVE EXCLUDED PARAMETERS
  ------------------------------------------------------------------------ */

  const entries =
    Object.entries(parameters).filter(
      ([key, value]) =>
        key !== "file" &&
        key !== "api_key" &&
        key !== "signature" &&
        value !== "",
    );

  /* ------------------------------------------------------------------------
     SORT ALPHABETICALLY
  ------------------------------------------------------------------------ */

  entries.sort(
    ([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
  );

  /* ------------------------------------------------------------------------
     BUILD STRING
  ------------------------------------------------------------------------ */

  const stringToSign =
    entries
      .map(
        ([key, value]) =>
          `${key}=${value}`,
      )
      .join("&");

  /* ------------------------------------------------------------------------
     SHA-1 + API SECRET
  ------------------------------------------------------------------------ */

  return createHash("sha1")
    .update(
      stringToSign + apiSecret,
      "utf8",
    )
    .digest("hex");
}

/* ============================================================================
   CLOUDINARY RESPONSE TYPES
============================================================================ */

type CloudinaryUploadResponse = {
  asset_id?: string;

  public_id?: string;

  secure_url?: string;

  format?: string;

  resource_type?: string;

  width?: number;

  height?: number;

  bytes?: number;

  created_at?: string;

  error?: {
    message?: string;
  };
};

/* ============================================================================
   CLOUDINARY UPLOAD
============================================================================ */

/**
 * Upload a verified employee profile picture.
 *
 * All Cloudinary credentials stay on the server.
 */
async function uploadToCloudinary({
  file,
  bytes,
  detectedType,
}: {
  file: File;

  bytes: Uint8Array;

  detectedType: string;
}) {
  const {
    cloudName,
    apiKey,
    apiSecret,
  } = getCloudinaryConfig();

  /* ------------------------------------------------------------------------
     TIMESTAMP
  ------------------------------------------------------------------------ */

  const timestamp =
    Math.floor(
      Date.now() / 1000,
    ).toString();

  /* ------------------------------------------------------------------------
     PARAMETERS TO SIGN
  ------------------------------------------------------------------------ */

  const parameters = {
    folder: CLOUDINARY_FOLDER,
    timestamp,
  };

  const signature =
    signCloudinaryParameters(
      parameters,
      apiSecret,
    );

  /* ------------------------------------------------------------------------
     FORM DATA
  ------------------------------------------------------------------------ */

  const uploadForm =
    new FormData();

  /*
   * Convert the uploaded bytes into a Blob.
   *
   * Using an ArrayBuffer copy ensures compatibility with
   * TypeScript's BlobPart typing across supported Node versions.
   */

  const imageBuffer =
    new ArrayBuffer(
      bytes.byteLength,
    );

  new Uint8Array(
    imageBuffer,
  ).set(bytes);

  const uploadFile =
    new Blob(
      [imageBuffer],
      {
        type: detectedType,
      },
    );

  uploadForm.append(
    "file",
    uploadFile,
    file.name,
  );

  uploadForm.append(
    "api_key",
    apiKey,
  );

  uploadForm.append(
    "timestamp",
    timestamp,
  );

  uploadForm.append(
    "folder",
    CLOUDINARY_FOLDER,
  );

  uploadForm.append(
    "signature",
    signature,
  );

  /* ------------------------------------------------------------------------
     CLOUDINARY REQUEST
  ------------------------------------------------------------------------ */

  const endpoint =
    `https://api.cloudinary.com/v1_1/` +
    `${encodeURIComponent(cloudName)}/image/upload`;

  const response =
    await fetch(
      endpoint,
      {
        method: "POST",

        body: uploadForm,

        cache: "no-store",

        signal:
          AbortSignal.timeout(
            UPLOAD_TIMEOUT,
          ),
      },
    );

  /* ------------------------------------------------------------------------
     READ RESPONSE
  ------------------------------------------------------------------------ */

  let result:
    CloudinaryUploadResponse;

  try {
    result =
      (await response.json()) as CloudinaryUploadResponse;
  } catch {
    throw new Error(
      "Cloudinary returned an invalid response.",
    );
  }

  /* ------------------------------------------------------------------------
     HANDLE UPLOAD FAILURE
  ------------------------------------------------------------------------ */

  if (
    !response.ok ||
    !result.secure_url ||
    !result.public_id
  ) {
    console.error(
      "[TEAM_AVATAR_UPLOAD] Cloudinary upload failed:",
      {
        status:
          response.status,

        message:
          result.error?.message ||
          "Unknown Cloudinary error",
      },
    );

    throw new Error(
      "Could not upload the profile picture to Cloudinary.",
    );
  }

  /* ------------------------------------------------------------------------
     VERIFY RETURNED URL
  ------------------------------------------------------------------------ */

  const expectedPrefix =
    `https://res.cloudinary.com/${cloudName}/image/upload/`;

  if (
    !result.secure_url.startsWith(
      expectedPrefix,
    )
  ) {
    throw new Error(
      "Cloudinary returned an unexpected image URL.",
    );
  }

  /* ------------------------------------------------------------------------
     RETURN IMAGE DETAILS
  ------------------------------------------------------------------------ */

  return {
    url:
      result.secure_url,

    publicId:
      result.public_id,

    width:
      result.width ?? null,

    height:
      result.height ?? null,

    format:
      result.format ?? null,

    bytes:
      result.bytes ?? null,
  };
}

/* ============================================================================
   POST /api/admin/team/avatar

   Secure employee profile picture upload.

   Supported:
   - JPEG
   - PNG
   - WebP

   Maximum size:
   - 5 MB

   Permissions:
   - Team manager required

   Storage:
   - Cloudinary

   Returns:
   {
     ok: true,
     url: "...",
     publicId: "...",
     width: 512,
     height: 512
   }

   Important:
   This endpoint uploads the image only.

   Saving the returned URL to the employee record
   is handled by:

   POST /api/admin/team
   PATCH /api/admin/team/[id]
============================================================================ */

export async function POST(
  request: NextRequest,
) {
  /* --------------------------------------------------------------------------
     AUTHENTICATION AND AUTHORISATION
  -------------------------------------------------------------------------- */

  try {
    await requireTeamManager();
  } catch (error) {
    const name =
      error instanceof Error
        ? error.name
        : "";

    const message =
      error instanceof Error
        ? error.message.toLowerCase()
        : "";

    if (
      name === "AuthenticationError" ||
      message.includes("unauthorized") ||
      message.includes("unauthenticated")
    ) {
      return jsonError(
        "Authentication required.",
        401,
      );
    }

    if (
      name === "AuthorisationError" ||
      message.includes("forbidden")
    ) {
      return jsonError(
        "You do not have permission to manage employee profile pictures.",
        403,
      );
    }

    console.error(
      "[TEAM_AVATAR_UPLOAD] Authorization failed:",
      error,
    );

    return jsonError(
      "Could not verify upload permissions.",
      500,
    );
  }

  try {
    /* ------------------------------------------------------------------------
       CHECK REQUEST TYPE
    ------------------------------------------------------------------------ */

    const contentType =
      request.headers.get(
        "content-type",
      ) ?? "";

    if (
      !contentType
        .toLowerCase()
        .includes(
          "multipart/form-data",
        )
    ) {
      return jsonError(
        "Upload the profile picture using multipart form data.",
        415,
      );
    }

    /* ------------------------------------------------------------------------
       CHECK DECLARED REQUEST SIZE
    ------------------------------------------------------------------------ */

    const contentLength =
      request.headers.get(
        "content-length",
      );

    if (
      contentLength &&
      Number(contentLength) >
        MAX_FILE_SIZE +
          1024 * 1024
    ) {
      return jsonError(
        "The upload request is too large.",
        413,
      );
    }

    /* ------------------------------------------------------------------------
       READ FORM DATA
    ------------------------------------------------------------------------ */

    let formData: FormData;

    try {
      formData =
        await request.formData();
    } catch {
      return jsonError(
        "Could not read the uploaded file.",
        400,
      );
    }

    const file =
      formData.get("file");

    /* ------------------------------------------------------------------------
       VERIFY FILE EXISTS
    ------------------------------------------------------------------------ */

    if (
      !(file instanceof File)
    ) {
      return jsonError(
        "Please select a profile picture.",
        400,
      );
    }

    /* ------------------------------------------------------------------------
       VERIFY MIME TYPE
    ------------------------------------------------------------------------ */

    if (
      !ALLOWED_TYPES.has(
        file.type,
      )
    ) {
      return jsonError(
        "Only JPG, PNG and WebP images are supported.",
        400,
      );
    }

    /* ------------------------------------------------------------------------
       VERIFY FILE SIZE
    ------------------------------------------------------------------------ */

    if (
      file.size === 0
    ) {
      return jsonError(
        "The selected image is empty.",
        400,
      );
    }

    if (
      file.size > MAX_FILE_SIZE
    ) {
      return jsonError(
        "The profile picture must be smaller than 5 MB.",
        413,
      );
    }

    /* ------------------------------------------------------------------------
       READ IMAGE BYTES
    ------------------------------------------------------------------------ */

    const bytes =
      new Uint8Array(
        await file.arrayBuffer(),
      );

    /* ------------------------------------------------------------------------
       DETECT IMAGE FORMAT
    ------------------------------------------------------------------------ */

    const detectedType =
      detectImageType(
        bytes,
      );

    if (!detectedType) {
      return jsonError(
        "The selected file is not a supported image.",
        400,
      );
    }

    /* ------------------------------------------------------------------------
       VERIFY ACTUAL CONTENT MATCHES MIME TYPE
    ------------------------------------------------------------------------ */

    if (
      detectedType !== file.type
    ) {
      return jsonError(
        "The image content does not match its file type.",
        400,
      );
    }

    /* ------------------------------------------------------------------------
       UPLOAD IMAGE
    ------------------------------------------------------------------------ */

    const uploaded =
      await uploadToCloudinary({
        file,
        bytes,
        detectedType,
      });

    /* ------------------------------------------------------------------------
       RETURN SUCCESS
    ------------------------------------------------------------------------ */

    return NextResponse.json(
      {
        ok: true,

        url:
          uploaded.url,

        publicId:
          uploaded.publicId,

        width:
          uploaded.width,

        height:
          uploaded.height,

        format:
          uploaded.format,

        bytes:
          uploaded.bytes,

        message:
          "Employee profile picture uploaded successfully.",
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    /* ------------------------------------------------------------------------
       LOG ERROR
    ------------------------------------------------------------------------ */

    console.error(
      "[TEAM_AVATAR_UPLOAD]",
      error,
    );

    /* ------------------------------------------------------------------------
       CLOUDINARY TIMEOUT
    ------------------------------------------------------------------------ */

    if (
      error instanceof Error &&
      (
        error.name === "TimeoutError" ||
        error.name === "AbortError"
      )
    ) {
      return jsonError(
        "The image upload timed out. Please try again.",
        504,
      );
    }

    /* ------------------------------------------------------------------------
       SERVER ERROR
    ------------------------------------------------------------------------ */

    return jsonError(
      "Could not upload the employee profile picture. Please try again.",
      500,
    );
  }
}