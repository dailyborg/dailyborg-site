import type { Metadata } from "next";

const DESCRIPTION =
    "What The Daily Borg stores about you: your subscription email, an optional phone number, the topics you pick, and your comments. Nothing is sold.";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description: DESCRIPTION,
    alternates: { canonical: "https://dailyborg.com/privacy" },
    openGraph: { type: "article", url: "https://dailyborg.com/privacy", title: "Privacy Policy | The Daily Borg", description: DESCRIPTION, images: ["/og-default.png"] },
};

export default function PrivacyPage() {
    return (
        <div className="container max-w-[900px] mx-auto px-4 py-16 md:py-24">
            <div className="space-y-12">
                <header className="space-y-6 border-b-4 border-foreground pb-8">
                    <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-7xl font-black tracking-tight uppercase leading-none">
                        Privacy Policy
                    </h1>
                    <p className="font-[family-name:var(--font-source-sans)] text-xl font-semibold uppercase tracking-widest text-muted-foreground">
                        What we store, and where
                    </p>
                </header>

                <article className="prose prose-lg dark:prose-invert font-[family-name:var(--font-source-sans)] text-foreground prose-headings:font-[family-name:var(--font-playfair)] prose-headings:font-black pb-16">
                    <p className="lead text-2xl font-[family-name:var(--font-playfair)] text-muted-foreground leading-relaxed">
                        You can read The Daily Borg without giving us anything. If you subscribe or leave a
                        comment, here is exactly what we keep.
                    </p>

                    <h2>1. If you subscribe</h2>
                    <p>
                        We store your email address, a phone number if you choose to give one, and the
                        topics or officials you asked to follow. These are stored as you typed them, in our
                        database, so that we can send you what you signed up for. They are not encrypted or
                        hashed, so treat the phone number as optional and skip it if you would rather not.
                    </p>
                    <p>
                        We do not sell, rent, or share subscriber lists with anyone: not advertisers, not
                        data brokers, not campaigns. Ask us to delete your record and we will.
                    </p>

                    <h2>2. If you leave a comment</h2>
                    <p>
                        We store the comment text, the display name you chose, and the email address you
                        signed in with. Your comment and display name are public. Your email address is
                        not shown on the site; it is visible only to site administrators, who use it to
                        moderate and to contact you if there is a problem with a comment.
                    </p>

                    <h2>3. What your browser stores</h2>
                    <p>
                        This site uses your browser&apos;s local storage rather than tracking cookies. It holds:
                    </p>
                    <ul>
                        <li>Your light or dark theme choice.</li>
                        <li>The edition label you were last shown.</li>
                        <li>The officials you have chosen to follow.</li>
                        <li>For site administrators only, a marker showing you are signed in to the admin tools.</li>
                    </ul>
                    <p>
                        All of that lives on your device. Clearing your browser data removes it.
                    </p>

                    <h2>4. Server logs and analytics</h2>
                    <p>
                        Our host records ordinary request information such as page addresses, timing, and
                        general location, in the same way any web server does. We keep a simple count of
                        page views so we know what is being read. We do not build advertising profiles and
                        we do not run third-party tracking scripts.
                    </p>

                    <h2>5. Payments</h2>
                    <p>
                        Paid subscriptions are handled by Stripe. Card details go to Stripe directly and
                        never touch our servers. We keep only the identifier Stripe gives us so we know
                        which subscription is yours.
                    </p>

                    <h2>6. Public officials</h2>
                    <p>
                        The Borg Record holds information about public officials taken from public records:
                        official rosters, published fact-check rulings, and recorded votes. That material is
                        already public and is not personal data we collected from you.
                    </p>

                    <div className="p-6 bg-muted border-l-4 border-foreground mt-12">
                        <p className="m-0 text-sm font-bold uppercase tracking-widest">
                            Effective September 2026. Deletion requests: pressroom@dailyborg.com
                        </p>
                    </div>
                </article>
            </div>
        </div>
    );
}
