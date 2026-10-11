import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  contractApiError,
  contractDTO,
  requireContractIdentity,
  requiredText,
  sendContractForSignature,
} from "@/lib/contracts/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    contractId: string;
  }>;
};

export async function POST(
  _request: NextRequest,
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

    const contract =
      await sendContractForSignature({
        identity,
        contractId: id,
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