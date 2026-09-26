import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
      <p className="gold-text font-display text-6xl">404</p>
      <p className="mt-2 text-sand">This path isn&apos;t on our heritage map.</p>
      <Link href="/" className="btn-gold mt-6">
        PAYANA →
      </Link>
    </div>
  );
}
