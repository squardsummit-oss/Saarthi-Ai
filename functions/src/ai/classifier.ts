import type { ClassificationResult } from "../types.js";

/**
 * Sector definitions — each maps keywords to a department + category.
 * This is the knowledge base for complaint classification.
 */
const SECTORS = [
  {
    category: "Water Supply",
    department: "Water & Sanitation",
    keywords: [
      "water", "pipeline", "pipe", "leak", "leaking", "supply", "tap",
      "drinking water", "bore", "borewell", "water tank", "contaminated",
      "dirty water", "no water", "low pressure", "water bill", "sewage",
      "drainage", "waterlogging", "flood", "overflow", "manhole",
    ],
  },
  {
    category: "Roads & Infrastructure",
    department: "Roads & Buildings",
    keywords: [
      "road", "pothole", "pit", "broken road", "crack", "footpath",
      "sidewalk", "bridge", "flyover", "construction", "barricade",
      "traffic signal", "signal", "divider", "speed breaker", "asphalt",
      "tar", "gravel", "highway", "lane", "junction",
    ],
  },
  {
    category: "Electricity",
    department: "Electricity Department",
    keywords: [
      "electricity", "power", "light", "current", "transformer",
      "pole", "wire", "cable", "outage", "blackout", "power cut",
      "voltage", "meter", "bill", "streetlight", "street light",
      "electric shock", "spark", "short circuit", "fuse",
    ],
  },
  {
    category: "Sanitation & Waste",
    department: "Sanitation Department",
    keywords: [
      "garbage", "waste", "trash", "dustbin", "dump", "cleaning",
      "sweeping", "dirty", "smell", "stink", "toilet", "public toilet",
      "urination", "defecation", "hygiene", "pest", "mosquito",
      "rats", "cockroach", "flies", "debris",
    ],
  },
  {
    category: "Public Safety",
    department: "Public Safety & Police",
    keywords: [
      "safety", "crime", "theft", "robbery", "assault", "fight",
      "violence", "harassment", "noise", "nuisance", "drunk",
      "illegal", "construction illegal", "encroachment", "trespass",
      "suspicious", "threat", "vandalism", "accident",
    ],
  },
  {
    category: "Parks & Environment",
    department: "Parks & Recreation",
    keywords: [
      "park", "garden", "tree", "plant", "green", "pollution",
      "air quality", "smoke", "burning", "fire", "deforestation",
      "playground", "bench", "fountain", "lake", "pond",
    ],
  },
  {
    category: "Healthcare",
    department: "Health Department",
    keywords: [
      "hospital", "clinic", "doctor", "medicine", "health",
      "ambulance", "emergency", "disease", "epidemic", "vaccination",
      "medical", "pharmacy", "fever", "infection", "patient",
    ],
  },
  {
    category: "Education",
    department: "Education Department",
    keywords: [
      "school", "college", "education", "teacher", "student",
      "classroom", "library", "exam", "scholarship", "admission",
      "fee", "hostel", "campus", "principal",
    ],
  },
  {
    category: "Transport",
    department: "Transport Department",
    keywords: [
      "bus", "train", "metro", "transport", "auto", "rickshaw",
      "taxi", "cab", "parking", "traffic", "congestion", "helmet",
      "license", "permit", "toll", "route", "schedule",
    ],
  },
  {
    category: "Housing",
    department: "Housing & Urban Dev",
    keywords: [
      "house", "apartment", "flat", "building", "construction",
      "permit", "plan", "approval", "rent", "tenant", "landlord",
      "eviction", "property", "land", "plot", "registration",
    ],
  },
];

/**
 * High-priority keyword patterns
 */
const PRIORITY_PATTERNS = {
  critical: /\b(death|dying|collapse|flood|fire|explosion|electrocution|life.?threatening)\b/i,
  high: /\b(urgent|emergency|danger|critical|immediate|sos|severe|accident|injured|blood)\b/i,
  low: /\b(minor|small|little|slightly|suggestion|feedback|request|improve)\b/i,
};

/**
 * Emotion detection patterns
 */
const EMOTION_PATTERNS = {
  angry: /\b(angry|furious|terrible|worst|disgusted|fed up|outrageous|pathetic|useless|hopeless)\b/i,
  anxious: /\b(worried|scared|afraid|anxious|concerned|help|please|urgent)\b/i,
  positive: /\b(happy|grateful|thank|appreciate|good|excellent)\b/i,
};

/**
 * Classify a complaint text into category, department, and priority.
 * Uses keyword-based matching with confidence scoring.
 */
export function classifyComplaint(text: string): ClassificationResult {
  const lower = text.toLowerCase();

  // ── Match against sectors ─────────────────────────────────
  let bestSector = SECTORS[0];
  let bestCount = 0;
  let bestMatched: string[] = [];

  for (const sector of SECTORS) {
    const matched: string[] = [];
    for (const kw of sector.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        matched.push(kw);
      }
    }
    if (matched.length > bestCount) {
      bestCount = matched.length;
      bestSector = sector;
      bestMatched = matched;
    }
  }

  // ── Priority detection ────────────────────────────────────
  let priority: ClassificationResult["priority"] = "medium";
  if (PRIORITY_PATTERNS.critical.test(lower)) {
    priority = "critical";
  } else if (PRIORITY_PATTERNS.high.test(lower)) {
    priority = "high";
  } else if (PRIORITY_PATTERNS.low.test(lower)) {
    priority = "low";
  }

  // Emotion escalation
  if (EMOTION_PATTERNS.angry.test(lower) && priority === "medium") {
    priority = "high";
  }

  // ── Confidence score ──────────────────────────────────────
  const confidence = bestCount === 0
    ? 10
    : Math.min(100, bestCount * 20 + 20);

  // ── Fallback for no matches ───────────────────────────────
  if (bestCount === 0) {
    return {
      category: "General Administration",
      department: "General Administration",
      priority,
      confidence: 10,
      matchedKeywords: [],
    };
  }

  return {
    category: bestSector.category,
    department: bestSector.department,
    priority,
    confidence,
    matchedKeywords: bestMatched,
  };
}
