import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center space-y-4 max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          VillageShare
        </h1>
        <p className="text-lg text-muted-foreground">
          Share items with your community through SMS-powered lending libraries.
          Create a shop, add your items, invite your neighbors, and lend via text message.
        </p>
      </div>
      <div className="flex gap-4">
        <Button asChild size="lg">
          <Link href="/login">Get Started</Link>
        </Button>
      </div>
    </div>
  );
}
