import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getD1Database } from "@/lib/db";

// Edge runtime isn't strictly required here but is good practice for global Next.js compat
export const runtime = "edge";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_mock", {});

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as any;
        const { subscriberId, email, channel } = body;

        if (!subscriberId) {
            return NextResponse.json({ error: "Missing subscriber ID" }, { status: 400 });
        }

        // 1. Verify user exists in the database
        const db = await getD1Database();
        if (!db) {
            return NextResponse.json({ error: "Failed to connect to local database mock." }, { status: 500 });
        }
        const userQuery = await db.prepare("SELECT * FROM subscribers WHERE id = ?").bind(subscriberId).first();

        if (!userQuery) {
            return NextResponse.json({ error: "Subscriber not found in database" }, { status: 404 });
        }

        // 2. Build Stripe Checkout Session
        // We use client_reference_id to securely track who paid for what in the Webhook
        const origin = req.headers.get("origin") || "http://localhost:3000";

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "subscription",
            client_reference_id: subscriberId, // VERY IMPORTANT: Links payment to our internal DB
            customer_email: channel === "email" ? email : undefined, // Pre-fill if we have an email
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: "Premium Director Access",
                            description: "Full intelligence reports delivered directly to your vectors.",
                        },
                        unit_amount: 99, // $0.99
                        recurring: {
                            interval: "month",
                        },
                    },
                    quantity: 1,
                },
            ],
            success_url: `${origin}/subscribe?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/subscribe?canceled=true`,
        });

        // 3. Return the exact Checkout URL for the frontend to visually redirect the user to
        return NextResponse.json({ url: session.url });

    } catch (err: any) {
        console.error("Stripe Checkout Error:", err);
        return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
    }
}
