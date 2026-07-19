/** Model A pricing — freemium athlete subscription + paid coach tier. */
export const TIERS = {
  free: {
    name: 'Free',
    price: '$0',
    tagline: 'Core logging, forever free',
    features: [
      'Unlimited run & cross-training logging',
      'Shoe mileage tracking',
      'Journal + daily checklist & streaks',
      'Weekly AI training summary',
    ],
  },
  premium: {
    name: 'Stride Premium',
    price: '$6.99/mo',
    annual: '$49.99/yr',
    tagline: 'The full AI coach',
    features: [
      'AI injury-prevention coach with evidence & recommendations',
      'Nutrition targets, barcode & photo logging',
      'Running form analysis (2/mo)',
      'Advanced analytics & unlimited history',
    ],
  },
  coach: {
    name: 'Coach Pro',
    price: '$9.99/mo',
    tagline: 'For coaches with rosters',
    features: [
      'Unlimited athletes',
      'Web dashboard with flag queue',
      'Comments & suggested workouts',
    ],
  },
} as const;
