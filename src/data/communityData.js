export const COMMUNITY_ANNOUNCEMENTS = [
  {
    id: 'ann-1',
    orgName: 'Food Bank of Iowa',
    type: 'Emergency Pop-up',
    badge: '🚨 Urgent Event',
    title: 'Weekend Mobile Produce Drop at North High School',
    body: 'Distributing over 10,000 lbs of fresh apples, sweet potatoes, and whole milk cartons this Saturday morning. Free drive-thru and walk-up lanes available.',
    date: 'Saturday, Oct 3 · 9:00 AM – 1:00 PM',
    location: 'North High School Paved Lot, Des Moines, IA',
    verified: true
  },
  {
    id: 'ann-2',
    orgName: 'City Harvest NYC',
    type: 'Program Update',
    badge: '📢 Expansion',
    title: 'New Fall Mobile Market Schedule in South Bronx',
    body: 'To meet rising demand, City Harvest is adding a bi-weekly Tuesday afternoon distribution at St. Ann’s Ave. Spanish and Haitian Creole translators on site.',
    date: 'Starting Tuesday, Oct 6 · 1:30 PM',
    location: '150 St. Ann’s Ave, Bronx, NY',
    verified: true
  },
  {
    id: 'ann-3',
    orgName: 'Pilsen Community Food Pantry',
    type: 'Community Need',
    badge: '🌾 Urgent Need',
    title: 'Urgent Call for Infant Formula & Size 4/5 Diapers',
    body: 'Pilsen pantry shelves are currently low on baby formula powder and toddler diapers. Drop-offs accepted Mon–Fri 9am–4pm or donate through our registry.',
    date: 'Updated today',
    location: '1850 S Throop St, Chicago, IL',
    verified: true
  },
  {
    id: 'ann-4',
    orgName: 'Hollywood Food Coalition',
    type: 'Volunteer Call',
    badge: '🤝 Volunteers Needed',
    title: 'Seeking Evening Prep & Packing Volunteers for Nightly Meals',
    body: 'Help prepare 300+ warm hot dinners tonight. Shifts run from 4:30 PM to 6:30 PM. No kitchen experience required.',
    date: 'Nightly shifts available',
    location: '5939 Hollywood Blvd, Los Angeles, CA',
    verified: true
  }
];

export const VOLUNTEER_SHIFTS = [
  {
    id: 'vol-1',
    orgName: 'Food Bank of Iowa',
    title: 'Fresh Produce Warehouse Sorting & Boxing',
    taskType: 'Warehouse Sorting',
    date: 'Tomorrow · 9:00 AM – 12:00 PM',
    location: '2220 E 17th St, Des Moines, IA',
    spotsAvailable: 4,
    skillsNeeded: 'Able to lift 25 lbs, stand for 2 hours',
    hoursGranted: 3,
    status: 'open',
    claimed: false,
    impactEstimate: '~450 lbs food sorted (375 meals)'
  },
  {
    id: 'vol-2',
    orgName: 'Greater Chicago Food Depository',
    title: 'Community Mobile Market Distribution Assistant',
    taskType: 'Mobile Distribution',
    date: 'Saturday, Oct 3 · 8:30 AM – 1:00 PM',
    location: 'Archer Heights, Chicago, IL',
    spotsAvailable: 2,
    skillsNeeded: 'Bilingual Spanish/English helpful, friendly customer service',
    hoursGranted: 4.5,
    status: 'open',
    claimed: false,
    impactEstimate: '~800 lbs groceries served (660 meals)'
  },
  {
    id: 'vol-3',
    orgName: 'City Harvest NYC',
    title: 'Rescue Route Driver Assistant (Van Pickup)',
    taskType: 'Food Rescue Pickup',
    date: 'Friday, Oct 2 · 10:00 AM – 2:00 PM',
    location: 'Lower Manhattan to Harlem, NY',
    spotsAvailable: 1,
    skillsNeeded: 'Valid driver license, physical loading',
    hoursGranted: 4,
    status: 'open',
    claimed: false,
    impactEstimate: '~1,200 lbs rescued (1,000 meals)'
  },
  {
    id: 'vol-4',
    orgName: 'University District Food Bank',
    title: 'Home Delivery Route Driver (North Seattle)',
    taskType: 'Home Delivery Route',
    date: 'Wednesday, Oct 7 · 1:00 PM – 4:00 PM',
    location: 'Roosevelt Way NE, Seattle, WA',
    spotsAvailable: 3,
    skillsNeeded: 'Own personal vehicle, smartphone for GPS routes',
    hoursGranted: 3,
    status: 'open',
    claimed: false,
    impactEstimate: 'Delivering groceries to 8 homebound families'
  }
];

export const FOOD_RESCUE_LISTINGS = [
  {
    id: 'res-1',
    donorName: 'Fresh Harvest Regional Co-Op',
    donorType: 'Grocery Wholesale',
    foodType: 'Fresh Apples & Pears (Sweet Gala / Bartlett)',
    quantityLbs: 2400,
    storageReq: 'Refrigerated or Cool Dry',
    expirationDays: '4-5 days remaining',
    location: 'Des Moines Regional Depot, IA',
    lat: 41.60,
    lng: -93.61,
    matchedOrg: 'Food Bank of Iowa',
    status: 'Matched · Pickup Scheduled',
    driverAssigned: 'Carlos M. (Volunteer Driver)',
    pickupWindow: 'Today 2:00 PM – 4:00 PM'
  },
  {
    id: 'res-2',
    donorName: 'Artisan Bakery Guild',
    donorType: 'Commercial Bakery',
    foodType: 'Whole Wheat Loaves, Sourdough & Bagels',
    quantityLbs: 650,
    storageReq: 'Dry Shelf-Stable',
    expirationDays: '3 days (Freezable)',
    location: 'West Loop Bakery, Chicago, IL',
    lat: 41.88,
    lng: -87.65,
    matchedOrg: 'Pilsen Community Food Pantry',
    status: 'Awaiting Volunteer Claim',
    driverAssigned: 'Unassigned',
    pickupWindow: 'Tomorrow 8:00 AM – 11:00 AM'
  },
  {
    id: 'res-3',
    donorName: 'California Citrus Growers Cooperative',
    donorType: 'Farm Surplus',
    foodType: 'Valencia Oranges & Sweet Tangerines',
    quantityLbs: 5200,
    storageReq: 'Cold Storage (40°F)',
    expirationDays: '7 days',
    location: 'Vernon Logistics Park, Los Angeles, CA',
    lat: 34.01,
    lng: -118.23,
    matchedOrg: 'Los Angeles Regional Food Bank',
    status: 'Completed & Delivered',
    driverAssigned: 'LA Food Bank Logistics Truck',
    pickupWindow: 'Completed this morning'
  }
];

export const IMPACT_METRICS = {
  residentsHelped: 52410,
  foodResourcesDiscovered: 124800,
  successfulReferrals: 11250,
  volunteerHours: 16840,
  volunteerShiftsFilled: 3890,
  poundsRescued: 948200,
  estimatedMeals: 790166, // 1.2 lbs per meal
  organizationsPartnered: 184,
  avgResponseSeconds: 4.2,
  updatedAt: '2026-10-02T09:14:00-05:00',
  reportingPeriod: 'Rolling 30 days',

  /* Twelve weeks of history behind each headline number, oldest first, so the
     card can show where the figure came from rather than only where it is.
     `delta` is the change against the preceding period of equal length. */
  trends: {
    residentsHelped: { delta: 6.4, series: [38200, 39650, 41100, 40850, 42600, 44300, 45120, 46800, 48250, 49600, 51080, 52410] },
    poundsRescued: { delta: 9.1, series: [712000, 731500, 749800, 742600, 768300, 790400, 806900, 831200, 858700, 889300, 918400, 948200] },
    estimatedMeals: { delta: 9.1, series: [593333, 609583, 624833, 618833, 640250, 658667, 672417, 692667, 715583, 741083, 765333, 790166] },
    volunteerHours: { delta: -2.3, series: [12400, 13100, 13850, 14200, 14980, 15400, 16100, 16720, 17050, 17240, 17020, 16840] },
  },

  /* Where the searching is happening. `trend` is the week-over-week change in
     searches; `unmetRate` is the share of those searches that ended without the
     person opening a location — the number that tells a coordinator where
     coverage is actually thin. */
  demandByZip: [
    { zip: '10454', city: 'Bronx, NY', requests: 7910, trend: 12.4, unmetRate: 18, partners: 24 },
    { zip: '90058', city: 'Los Angeles, CA', requests: 6540, trend: 8.1, unmetRate: 23, partners: 19 },
    { zip: '60632', city: 'Chicago, IL', requests: 5890, trend: -3.2, unmetRate: 14, partners: 22 },
    { zip: '77029', city: 'Houston, TX', requests: 5320, trend: 15.7, unmetRate: 31, partners: 11 },
    { zip: '50309', city: 'Des Moines, IA', requests: 4820, trend: 2.6, unmetRate: 9, partners: 17 },
    { zip: '30344', city: 'Atlanta, GA', requests: 4610, trend: 6.9, unmetRate: 26, partners: 13 },
    { zip: '98105', city: 'Seattle, WA', requests: 3740, trend: -1.4, unmetRate: 12, partners: 15 },
    { zip: '80218', city: 'Denver, CO', requests: 3120, trend: 4.3, unmetRate: 17, partners: 10 }
  ],

  /* `fillRate` is how often a request for that category found a location with
     it actually in stock — demand alone hides the shortages. */
  categoryBreakdown: [
    { category: 'Fresh Produce & Fruit', percent: 38, requests: 47420, fillRate: 86 },
    { category: 'Dairy & Fresh Eggs', percent: 24, requests: 29950, fillRate: 74 },
    { category: 'Infant Formula & Diapers', percent: 16, requests: 19960, fillRate: 52 },
    { category: 'Special Diet (Halal/Kosher/GF)', percent: 12, requests: 14970, fillRate: 61 },
    { category: 'Pantry Staples & Grains', percent: 10, requests: 12480, fillRate: 91 }
  ]
};

/* ---------------------------------------------------------------------------
   What people actually do on the site.

   Everything here is aggregated and anonymized: a ZIP code and an action, never
   a person, a name or a device. It exists so a coordinator can see where the
   service is failing someone — a search that ended in nothing, a category that
   keeps coming back unfilled — not so anyone can be followed around.
--------------------------------------------------------------------------- */

export const USER_ACTIVITY = {
  /* The 30-day figures are the base; the other windows scale from them, which
     is what the range selector switches between. */
  windowScale: { '7d': 0.238, '30d': 1, '90d': 2.86 },

  totals: {
    sessions: 84120,
    searches: 191400,
    assistantConversations: 26740,
    placesOpened: 47910,
    avgSessionSeconds: 247,
    returningShare: 41,
  },

  /* The resident journey, step by step. Each step's share is measured against
     the step above it, so the drop-off is readable without arithmetic. */
  funnel: [
    { step: 'Session started', count: 84120, note: 'Arrived from search, a partner link or a saved page' },
    { step: 'Searched for food', count: 68340, note: 'Entered a ZIP, shared location or asked the navigator' },
    { step: 'Opened a location', count: 47910, note: 'Viewed hours, stock and eligibility detail' },
    { step: 'Took an action', count: 29480, note: 'Got directions, called ahead or saved the place' },
    { step: 'Reserved a pickup', count: 11250, note: 'Held a slot and received a pass code' },
  ],

  /* How people reach a location. Three ways, so three fixed hues — the only
     categorical scale in the report. */
  channels: [
    { name: 'AI navigator', sessions: 26740, hue: '#b5222c' },
    { name: 'Map & filters', sessions: 38610, hue: '#d4820f' },
    { name: 'Direct search', sessions: 18770, hue: '#1b6ea8' },
  ],

  /* Searches by hour of day, local to the resident. The evening ridge is the
     operational point: it is when the fewest pantries are open. */
  hourly: [
    { hour: 0, searches: 820 }, { hour: 1, searches: 540 }, { hour: 2, searches: 410 },
    { hour: 3, searches: 360 }, { hour: 4, searches: 480 }, { hour: 5, searches: 910 },
    { hour: 6, searches: 2140 }, { hour: 7, searches: 4320 }, { hour: 8, searches: 6890 },
    { hour: 9, searches: 8740 }, { hour: 10, searches: 9910 }, { hour: 11, searches: 10480 },
    { hour: 12, searches: 11240 }, { hour: 13, searches: 10120 }, { hour: 14, searches: 9340 },
    { hour: 15, searches: 9870 }, { hour: 16, searches: 11580 }, { hour: 17, searches: 13420 },
    { hour: 18, searches: 14960 }, { hour: 19, searches: 13110 }, { hour: 20, searches: 10240 },
    { hour: 21, searches: 7380 }, { hour: 22, searches: 4590 }, { hour: 23, searches: 2340 },
  ],

  /* Service quality, each with the threshold it is being held to. */
  health: [
    { label: 'Search to recommendation', value: '4.2s', target: 'Target under 6s', status: 'good' },
    { label: 'Navigator answered without escalation', value: '88%', target: 'Target above 85%', status: 'good' },
    { label: 'Listings verified in last 14 days', value: '79%', target: 'Target above 90%', status: 'warning' },
    { label: 'Searches ending with no match', value: '11%', target: 'Target under 8%', status: 'warning' },
    { label: 'Reserved pickups collected', value: '94%', target: 'Target above 90%', status: 'good' },
  ],

  /* The live monitor draws from these shapes. No two events name the same
     person, because no event names a person at all. */
  eventTypes: [
    { id: 'search', label: 'Searches', hue: '#b5222c' },
    { id: 'assistant', label: 'Navigator', hue: '#d4820f' },
    { id: 'reservation', label: 'Reservations', hue: '#1b6ea8' },
    { id: 'report', label: 'Reports', hue: '#7f675c' },
  ],

  eventTemplates: [
    { type: 'search', text: 'Searched “open now, no ID” near {zip}', status: 'ok' },
    { type: 'search', text: 'Filtered for fresh produce within 3 miles of {zip}', status: 'ok' },
    { type: 'search', text: 'Searched “halal pantry” near {zip} — no match returned', status: 'attention' },
    { type: 'search', text: 'Filtered for sites reachable by transit near {zip}', status: 'ok' },
    { type: 'assistant', text: 'Asked the navigator about baby formula availability in {zip}', status: 'ok' },
    { type: 'assistant', text: 'Navigator matched 3 verified sites for a household of 5 in {zip}', status: 'ok' },
    { type: 'assistant', text: 'Navigator could not answer an eligibility question from {zip}', status: 'attention' },
    { type: 'reservation', text: 'Reserved a 4:30pm pickup slot in {zip}', status: 'ok' },
    { type: 'reservation', text: 'Pickup pass collected on arrival in {zip}', status: 'ok' },
    { type: 'reservation', text: 'Reservation released unclaimed in {zip}', status: 'attention' },
    { type: 'report', text: 'Neighbor reported changed hours for a pantry in {zip}', status: 'attention' },
    { type: 'report', text: 'Community report confirmed by an administrator in {zip}', status: 'ok' },
  ],
};
