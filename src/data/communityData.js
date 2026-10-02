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
  demandByZip: [
    { zip: '50309', city: 'Des Moines, IA', requests: 4820 },
    { zip: '10454', city: 'Bronx, NY', requests: 7910 },
    { zip: '90058', city: 'Los Angeles, CA', requests: 6540 },
    { zip: '60632', city: 'Chicago, IL', requests: 5890 },
    { zip: '77029', city: 'Houston, TX', requests: 5320 },
    { zip: '30344', city: 'Atlanta, GA', requests: 4610 },
    { zip: '98105', city: 'Seattle, WA', requests: 3740 },
    { zip: '80218', city: 'Denver, CO', requests: 3120 }
  ],
  categoryBreakdown: [
    { category: 'Fresh Produce & Fruit', percent: 38 },
    { category: 'Dairy & Fresh Eggs', percent: 24 },
    { category: 'Infant Formula & Diapers', percent: 16 },
    { category: 'Special Diet (Halal/Kosher/GF)', percent: 12 },
    { category: 'Pantry Staples & Grains', percent: 10 }
  ]
};
