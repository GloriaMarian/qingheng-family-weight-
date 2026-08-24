import { getLocalUser } from "../../../auth";

export const runtime = "edge";

export async function GET() {
  const user = await getLocalUser();
  return Response.json({ user });
}
