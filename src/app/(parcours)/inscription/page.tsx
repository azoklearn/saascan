import type { Metadata } from "next";
import { AuthScreen } from "@/components/account/auth-screen";
export const metadata: Metadata = { title: "Créer votre compte" };
export default function Page() { return <AuthScreen mode="inscription" />; }
