export function getImageForContext(dataPayload: any): string {
  let primaryImage = dataPayload.aiGeneratedImageUrl || dataPayload.hero_image_url;

  // Sanitize RSS tracking pixels and broken incomplete URLs
  if (primaryImage) {
    if (primaryImage.startsWith('//')) {
      primaryImage = `https:${primaryImage}`;
    }
    if (primaryImage.length < 15 || primaryImage.includes('1x1') || primaryImage.includes("pixel")) {
      primaryImage = null;
    }
  }

  // 1. Process valid, surviving image urls
  if (primaryImage && primaryImage.startsWith('http') && primaryImage !== "https://example.com/generated-hero.jpg") {
    return primaryImage;
  }

  // 2. Fallbacks to high-quality relevant Unsplash images based on desk
  const desk = (dataPayload.desk || dataPayload.category || "Politics").toLowerCase();
  
  const fallbacks: Record<string, string[]> = {
    politics: [
      "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?q=80&w=2070&auto=format&fit=crop", // Parliament
      "https://images.unsplash.com/photo-1540910419892-494b28c31cb1?q=80&w=2070&auto=format&fit=crop", // Capitol dome
      "https://images.unsplash.com/photo-1555848962-6e79363ec58f?q=80&w=2070&auto=format&fit=crop", // Mics / Press
      "https://images.unsplash.com/photo-1552687108-bc81eb4d356c?q=80&w=2070&auto=format&fit=crop", // White House flags
      "https://images.unsplash.com/photo-1563804868-b7eb8e49d682?q=80&w=2070&auto=format&fit=crop" // Briefing folder
    ],
    business: [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop", // Skyscraper
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=2070&auto=format&fit=crop", // Stock market chart
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=2070&auto=format&fit=crop", // Business meeting / Handshake
      "https://images.unsplash.com/photo-1554757388-3ca6b12a87bf?q=80&w=2070&auto=format&fit=crop"  // Financial district
    ],
    science: [
      "https://images.unsplash.com/photo-1507413245164-6160d8298b31?q=80&w=2070&auto=format&fit=crop", // Circuit board
      "https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=2070&auto=format&fit=crop", // Lab microscope
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2070&auto=format&fit=crop", // Earth from space
      "https://images.unsplash.com/photo-1518152006812-edab29b069ac?q=80&w=2071&auto=format&fit=crop" // DNA research
    ],
    crime: [
      "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=2070&auto=format&fit=crop", // Scales of Justice
      "https://images.unsplash.com/photo-1505664194779-8beaceb93744?q=80&w=2070&auto=format&fit=crop", // Police tape / lights at night
      "https://images.unsplash.com/photo-1563630381190-78c336ea545a?q=80&w=2070&auto=format&fit=crop", // Gavel and law book
      "https://images.unsplash.com/photo-1589391886645-d51941baf7fb?q=80&w=2070&auto=format&fit=crop" // Prison bars
    ],
    entertainment: [
      "https://images.unsplash.com/photo-1514525253344-99a343467669?q=80&w=2062&auto=format&fit=crop", // Vinyl record
      "https://images.unsplash.com/photo-1598899134739-24c46f58b8d0?q=80&w=2070&auto=format&fit=crop", // Movie clapperboard
      "https://images.unsplash.com/photo-1493225457124-a1a2a5956093?q=80&w=2070&auto=format&fit=crop", // Concert stage
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2059&auto=format&fit=crop" // Film reels
    ],
    sports: [
      "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=2070&auto=format&fit=crop", // Track starting line
      "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=2070&auto=format&fit=crop", // Stadium lights
      "https://images.unsplash.com/photo-1508344928928-71e1b531ee6f?q=80&w=2070&auto=format&fit=crop", // Soccer field overview
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=2070&auto=format&fit=crop" // Boxing ring
    ],
    education: [
      "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=2070&auto=format&fit=crop", // Graduation caps
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=2070&auto=format&fit=crop", // University library
      "https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=2070&auto=format&fit=crop", // Chalkboard classroom
      "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=2073&auto=format&fit=crop" // Books and apple
    ]
  };

  const options = fallbacks[desk] || fallbacks.politics;
  
  // Deterministic hash based on slug or title so the image stays consistent for the same article
  const hashString = dataPayload.slug || dataPayload.title || "fallback";
  let hash = 0;
  for (let i = 0; i < hashString.length; i++) {
    hash = hashString.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % options.length;

  return options[index];
}
