import { auth } from "@/lib/auth"; // path to your Better Auth server instance
import { redirect } from "next/navigation";
import { headers } from "next/headers";

async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(), // you need to pass the headers object.
  });

  if(!session) {
    redirect("/")
  } else {
    console.log(session)
  }

  return <div>Olá {session.user.name}</div>;
}

export default DashboardPage;
