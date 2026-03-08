import * as React from "react"
import { cn } from "@/lib/utils"

const NewsGrid = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-6", className)}
            {...props}
        />
    )
)
NewsGrid.displayName = "NewsGrid"

export { NewsGrid }
