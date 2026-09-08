"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Send, Loader2, LogIn, ArrowRight, User, AlertCircle } from "lucide-react";
import Link from "next/link";
import { formatTimeAgo } from "@/lib/utils";

const TOKEN_KEY = "borg_commenter_token";
const NAME_KEY = "borg_commenter_name";
const MAX_COMMENT_LENGTH = 2000;

interface Comment {
    id: string;
    display_name: string;
    content: string;
    created_at: string;
}

interface CommenterSession {
    token: string;
    name: string;
}

interface CommentSectionProps {
    pageType: 'politician' | 'borg-record' | 'article';
    pageSlug: string;
}

export default function CommentSection({ pageType, pageSlug }: CommentSectionProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [session, setSession] = useState<CommenterSession | null>(null);

    // Auth state
    const [authEmail, setAuthEmail] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState('');

    // Compose state
    const [newComment, setNewComment] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const [postError, setPostError] = useState('');

    // Restore the commenting session from this browser on mount.
    useEffect(() => {
        try {
            const token = localStorage.getItem(TOKEN_KEY);
            const name = localStorage.getItem(NAME_KEY);
            if (token && name) setSession({ token, name });
        } catch (e) {
            // storage blocked, stay signed out
        }
    }, []);

    const clearSession = useCallback(() => {
        try {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(NAME_KEY);
        } catch (e) {
            // ignore
        }
        setSession(null);
    }, []);

    // Fetch comments (the API caches this response for 60 seconds)
    const fetchComments = useCallback(async () => {
        try {
            const res = await fetch(`/api/comments?page_type=${pageType}&page_slug=${pageSlug}`);
            if (res.ok) {
                const data = await res.json() as any;
                setComments(data.comments || []);
            }
        } catch (e) {
            console.error('Failed to load comments', e);
        } finally {
            setIsLoading(false);
        }
    }, [pageType, pageSlug]);

    useEffect(() => {
        fetchComments();
    }, [fetchComments]);

    // Authenticate subscriber and store the returned token
    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError('');

        try {
            const res = await fetch('/api/comments/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: authEmail.trim().toLowerCase() })
            });

            const data = await res.json() as any;

            if (res.ok && data.token) {
                const name = data.display_name || 'Subscriber';
                try {
                    localStorage.setItem(TOKEN_KEY, data.token);
                    localStorage.setItem(NAME_KEY, name);
                } catch (storageError) {
                    // storage blocked, the session still works for this page view
                }
                setSession({ token: data.token, name });
                setAuthEmail('');
            } else if (data.error === 'not_subscriber') {
                setAuthError('not_subscriber');
            } else {
                setAuthError(data.message || data.error || 'Authentication failed');
            }
        } catch (e) {
            setAuthError('Network error. Please try again.');
        } finally {
            setAuthLoading(false);
        }
    };

    // Post a comment
    const handlePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session || !newComment.trim()) return;

        setIsPosting(true);
        setPostError('');

        try {
            const res = await fetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: session.token,
                    page_type: pageType,
                    page_slug: pageSlug,
                    content: newComment.trim().slice(0, MAX_COMMENT_LENGTH)
                })
            });

            if (res.status === 401) {
                clearSession();
                setPostError('Your commenting session expired. Enter your subscriber email again to continue.');
                return;
            }

            const data = await res.json() as any;

            if (res.ok && data.comment) {
                // The list is cached for 60 seconds, so show the new comment locally instead of refetching.
                setComments(prev => [data.comment, ...prev]);
                setNewComment('');
            } else {
                setPostError(data.error || data.message || 'Failed to post comment.');
            }
        } catch (e) {
            setPostError('Network error. Please try again.');
        } finally {
            setIsPosting(false);
        }
    };

    const handleLogout = () => {
        clearSession();
        setPostError('');
    };

    return (
        <div className="mt-12 border-t-2 border-border pt-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <MessageSquare className="w-5 h-5 text-accent" />
                    <h3 className="font-serif text-2xl font-bold tracking-tight">Discussion</h3>
                    <span className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-0.5 border border-border">
                        {comments.length}
                    </span>
                </div>
                {session && (
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                            Signed in as <strong className="text-foreground">{session.name}</strong>
                        </span>
                        <button
                            onClick={handleLogout}
                            className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground hover:text-destructive transition-colors"
                        >
                            Sign out
                        </button>
                    </div>
                )}
            </div>

            {/* Compose Area */}
            {session ? (
                <form onSubmit={handlePost} className="mb-8">
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                                <User className="w-3 h-3 text-accent" />
                            </div>
                            <span className="text-xs font-bold text-foreground">{session.name}</span>
                        </div>
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
                            placeholder="Share your thoughts on this record..."
                            maxLength={MAX_COMMENT_LENGTH}
                            rows={3}
                            className="w-full bg-background border border-border p-4 text-sm font-medium resize-none focus:ring-2 focus:ring-foreground/40 focus:border-foreground transition-colors placeholder:text-muted-foreground/50"
                        />
                        <div className="flex items-center justify-between mt-2">
                            <span className={`text-[10px] font-mono ${newComment.length >= MAX_COMMENT_LENGTH ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                {newComment.length}/{MAX_COMMENT_LENGTH}
                            </span>
                            <button
                                type="submit"
                                disabled={isPosting || !newComment.trim()}
                                className="flex items-center gap-2 bg-foreground text-background px-5 py-2 text-xs font-bold uppercase tracking-widest hover:bg-foreground/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {isPosting ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                    <>Post <Send className="w-3 h-3" /></>
                                )}
                            </button>
                        </div>
                        {postError && (
                            <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-bold text-destructive">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                                {postError}
                            </p>
                        )}
                    </div>
                </form>
            ) : (
                <div className="mb-8 border border-border bg-muted/10 p-6">
                    {postError && (
                        <p role="alert" className="mb-4 flex items-start gap-1.5 text-xs font-bold text-destructive">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                            {postError}
                        </p>
                    )}
                    {authError === 'not_subscriber' ? (
                        <div className="text-center space-y-3">
                            <p className="text-sm font-bold text-foreground">You must be a subscriber to comment.</p>
                            <p className="text-xs text-muted-foreground">Join the conversation by subscribing, it is free.</p>
                            <Link
                                href="/subscribe"
                                className="inline-flex items-center gap-2 bg-accent text-[#181D25] px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
                            >
                                Subscribe Now <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleAuth} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                                    <LogIn className="w-3 h-3 inline mr-1" />
                                    Enter your subscriber email to comment
                                </label>
                                <input
                                    type="email"
                                    value={authEmail}
                                    onChange={(e) => { setAuthEmail(e.target.value); setAuthError(''); }}
                                    placeholder="you@email.com"
                                    required
                                    className="w-full bg-background border border-border p-3 text-sm font-medium focus:ring-2 focus:ring-foreground/40 focus:border-foreground transition-colors"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={authLoading || !authEmail}
                                className="flex items-center justify-center gap-2 bg-foreground text-background px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-foreground/90 transition-all disabled:opacity-40 whitespace-nowrap"
                            >
                                {authLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Verify & Comment'}
                            </button>
                        </form>
                    )}
                    {authError && authError !== 'not_subscriber' && (
                        <p role="alert" className="text-destructive text-xs font-bold mt-2">{authError}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-3">
                        Don&apos;t have an account? <Link href="/subscribe" className="underline hover:text-foreground transition-colors">Subscribe for free</Link> to join the conversation.
                    </p>
                </div>
            )}

            {/* Comments List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
            ) : comments.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border">
                    <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground font-medium">No comments yet. Be the first to share your perspective.</p>
                </div>
            ) : (
                <div className="space-y-0 divide-y divide-border">
                    {comments.map((comment, i) => (
                        <div
                            key={comment.id}
                            className="py-4 group"
                            style={{ animationDelay: `${i * 50}ms` }}
                        >
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center border border-border">
                                    <span className="text-[10px] font-bold text-foreground">
                                        {(comment.display_name || '?').charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <span className="text-xs font-bold text-foreground">{comment.display_name}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                    {formatTimeAgo(comment.created_at)}
                                </span>
                            </div>
                            <p className="text-sm text-foreground/90 leading-relaxed pl-8">
                                {comment.content}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
