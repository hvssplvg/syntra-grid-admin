import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  contractApiError,
  contractDTO,
  markContractSigned,
  optionalDateTime,
  optionalText,
  requireContractIdentity,
  requiredText,
} from "@/lib/contracts/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    contractId: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await requireContractIdentity();

    const { contractId } =
      await context.params;

    const id =
      requiredText(
        contractId,
        "Contract ID",
      );

    const body =
      await readOptionalJsonBody(
        request,
      );

    const signedAt =
      optionalDateTime(
        body.signedAt,
        "Signed date",
      );

    const contract =
      await markContractSigned({
        identity,
        contractId: id,

        ...(signedAt
          ? {
              signedAt,
            }
          : {}),

        signedByClientName:
          optionalText(
            body.signedByClientName,
            "Client signatory",
          ),

        signedByCompanyName:
          optionalText(
            body.signedByCompanyName,
            "Company signatory",
          ),
      });

    return NextResponse.json(
      {
        contract:
          contractDTO(
            contract,
            identity,
          ),
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

async function readOptionalJsonBody(
  request: NextRequest,
): Promise<
  Record<string, unknown>
> {
  const text =
    await request.text();

  if (!text.trim()) {
    return {};
  }

  let body: unknown;

  try {
    body =
      JSON.parse(text);
  } catch {
    throw new Error(
      "Request body must contain valid JSON.",
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw new Error(
      "Request body must be a JSON object.",
    );
  }

  return body as Record<
    string,
    unknown
  >;
}

function errorResponse(
  error: unknown,
) {
  const result =
    contractApiError(error);

  return NextResponse.json(
    {
      error: result.message,
    },
    {
      status: result.status,
    },
  );
}