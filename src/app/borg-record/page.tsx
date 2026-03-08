import Link from "next/link";
import { NewsGrid } from "@/components/ui/grid";
import { Search } from "lucide-react";

export default function BorgRecordDirectory() {
    return (
        <div className="container mx-auto px-4 md:px-8 py-8 md:py-16">
            <div className="max-w-3xl mb-12">
                <h1 className="font-serif text-5xl md:text-6xl font-extrabold tracking-tight mb-6">The Borg Record</h1>
                <p className="text-xl text-muted-foreground font-serif leading-relaxed">
                    The public record, standardized and documented. Search for federal officials, track campaign promises, review their verified voting records, and measure their consistency over time.
                </p>
                <div className="mt-8 flex max-w-md items-center border-b-2 border-foreground group focus-within:border-accent transition-colors">
                    <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-accent" />
                    <input
                        type="text"
                        placeholder="Search officials by name or state..."
                        className="w-full bg-transparent border-none outline-none p-3 text-lg font-medium placeholder:font-normal placeholder:text-muted-foreground"
                    />
                </div>
            </div>

            <div className="border-t-4 border-foreground pt-4 mb-8 flex justify-between items-end mt-16">
                <h2 className="font-serif text-3xl font-bold uppercase tracking-tight">Active Profiles</h2>
            </div>

            <NewsGrid>
                {[
                    { name: "Eleanor Vance", office: "U.S. Senate", state: "OH", party: "Democrat", consistency: "Mixed Record" },
                    { name: "Marcus Thorne", office: "House of Representatives", state: "TX-12", party: "Republican", consistency: "Aligned" },
                    { name: "Sarah Jenkins", office: "U.S. Senate", state: "NY", party: "Democrat", consistency: "Shifted" },
                    { name: "David Chen", office: "House of Representatives", state: "CA-45", party: "Republican", consistency: "Incomplete Record" },
                ].map((pol) => (
                    <Link key={pol.name} href={`/borg-record/politicians/sample-slug`} className="col-span-1 md:col-span-2 lg:col-span-3 border border-border group hover:border-accent transition-colors block">
                        <div className="aspect-[3/4] bg-muted relative">
                            <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent flex flex-col justify-end p-4">
                                <span className="text-xs font-bold uppercase tracking-widest text-accent bg-accent/10 w-fit px-2 py-1 mb-2">{pol.party}</span>
                                <h3 className="font-serif text-2xl font-bold leading-tight group-hover:text-accent transition-colors">{pol.name}</h3>
                                <p className="text-sm font-medium text-muted-foreground mt-1 uppercase tracking-wider">{pol.office} • {pol.state}</p>
                            </div>
                        </div>
                        <div className="p-4 bg-background border-t border-border flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                            <span className="text-muted-foreground">Consistency</span>
                            <span className={pol.consistency === "Mixed Record" ? "text-destructive" : (pol.consistency === "Shifted" ? "text-accent" : "text-success")}>{pol.consistency}</span>
                        </div>
                    </Link>
                ))}
            </NewsGrid>
        </div>
    );
}
