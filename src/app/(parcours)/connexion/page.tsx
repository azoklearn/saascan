import type { Metadata } from "next";
import { AuthScreen } from "@/components/account/auth-screen";
export const metadata: Metadata = { title: "Se connecter" };
export default function Page() { return <AuthScreen mode="connexion" />; }
