import json
from pathlib import Path

curated = json.load(open('api/demo_places.json', encoding='utf-8'))
osm = json.load(open('api/osm_places.json', encoding='utf-8'))

def normalize_osm(p):
    city = p.get('city') or 'San Francisco Bay Area'
    return {
        'id': p['id'],
        'name': p['name'],
        'type': p['type'],
        'typeLabel': p.get('typeLabel', 'Community Food Resource'),
        'tagline': p.get('tagline', f'Community-mapped food assistance resource in {city}'),
        'neighborhood': p.get('neighborhood', city),
        'address': p.get('address', 'Address on file'),
        'city': city,
        'state': 'CA',
        'zip': p.get('zip', '94000'),
        'cityStateZip': f'{city}, CA',
        'lat': p['lat'],
        'lng': p['lng'],
        'phone': p.get('phone', '(415) 555-0100'),
        'email': p.get('email', 'info@communityfood.org'),
        'website': p.get('website', 'https://openstreetmap.org'),
        'directionsUrl': f"https://www.google.com/maps/dir/?api=1&destination={p['lat']},{p['lng']}",
        'verifiedDate': 'Community Verified',
        'verifiedBadge': False,
        'callAheadWarning': True,
        'requirements': p.get('requirements', 'Community food assistance resource. Call ahead or check online for current hours.'),
        'languages': ['English', 'Spanish (Español)'],
        'dietary': ['Vegetarian'],
        'hasFreshProduce': True,
        'transitInfo': 'Public transit accessible.',
        'accessibility': 'Accessible facility.',
        'eligibilityTags': ['No ID Required', 'Walk-ins Welcome'],
        'images': ['https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=900&q=80'],
        'hoursSummary': p.get('hoursSummary', 'Hours vary · Check site'),
        'weeklyHours': p.get('weeklyHours', [
            {'day': 'Monday', 'hours': '9:00 AM – 3:00 PM', 'open': 9, 'close': 15},
            {'day': 'Wednesday', 'hours': '9:00 AM – 3:00 PM', 'open': 9, 'close': 15},
            {'day': 'Friday', 'hours': '9:00 AM – 3:00 PM', 'open': 9, 'close': 15}
        ]),
        'services': ['Food distribution', 'Community relief'],
        'inventory': [{'category': 'Fresh Produce', 'item': 'Produce, pantry staples & groceries', 'stock': 'high', 'note': 'Community supply'}],
        'urgentNeeds': ['Non-perishable food', 'Volunteers'],
        'acceptsReservations': False,
        'reservationWindows': []
    }

curated_ids = {p['id'] for p in curated}
merged = list(curated)

for p in osm:
    too_close = False
    for c in curated:
        if abs(c['lat'] - p['lat']) < 0.003 and abs(c['lng'] - p['lng']) < 0.003:
            too_close = True
            break
    if not too_close and p['id'] not in curated_ids:
        merged.append(normalize_osm(p))

print(f'Total combined Bay Area places across the entire map: {len(merged)}')

# Save to api/demo_places.json
Path('api/demo_places.json').write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding='utf-8')

# Save to src/data/places.js
places_js_header = '''export const PLACE_CATEGORIES = [
  { id: 'all', label: 'All Places', icon: '📍' },
  { id: 'food-bank', label: 'Food Banks', icon: '🥫' },
  { id: 'pantry', label: 'Food Pantries', icon: '🧺' },
  { id: 'hot-meal', label: 'Hot Meals & Kitchens', icon: '🍲' },
  { id: 'community-fridge', label: 'Community Fridges', icon: '🧊' },
  { id: 'mobile', label: 'Mobile Distributions', icon: '🚐' }
];

export const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Halal',
  'Kosher',
  'Gluten-Free',
  'Diabetic-Friendly',
  'Dairy-Free',
  'No-Cook / Pull-Tab Cans',
  'Baby Formula / Infant Food'
];

export const LANGUAGE_OPTIONS = [
  'English',
  'Spanish (Español)',
  'Mandarin (中文)',
  'Cantonese',
  'Vietnamese (Tiếng Việt)',
  'Arabic (العربية)',
  'Somali (Soomaali)',
  'Haitian Creole'
];

export const ELIGIBILITY_OPTIONS = [
  'No ID Required',
  'No Proof of Income',
  'Walk-ins Welcome',
  'Drive-Thru Available',
  'Home Delivery Available',
  'Client-Choice Market'
];

export const PLACES = '''

get_is_open_now_code = '''

export function getIsOpenNow(place) {
  if (place.type === 'community-fridge') return { isOpen: true, text: 'Open 24/7' };
  
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = days[now.getDay()];
  const currentHour = now.getHours() + now.getMinutes() / 60;
  
  const todaySchedule = place.weeklyHours?.find((h) => h.day === todayName);
  if (!todaySchedule || todaySchedule.open === 0) {
    return { isOpen: false, text: 'Closed today · Check schedule' };
  }
  
  if (currentHour >= todaySchedule.open && currentHour <= todaySchedule.close) {
    const closeHours = Math.floor(todaySchedule.close);
    const closeMinutes = Math.round((todaySchedule.close - closeHours) * 60);
    const ampm = closeHours >= 12 ? 'PM' : 'AM';
    const displayHour = closeHours > 12 ? closeHours - 12 : closeHours === 0 ? 12 : closeHours;
    const displayMin = closeMinutes > 0 ? `:${closeMinutes.toString().padStart(2, '0')}` : ':00';
    return { isOpen: true, text: `Open now · Closes at ${displayHour}${displayMin} ${ampm}` };
  } else if (currentHour < todaySchedule.open) {
    return { isOpen: false, text: `Closed now · Opens at ${todaySchedule.open}:00 AM` };
  } else {
    return { isOpen: false, text: 'Closed for the day' };
  }
}
'''

Path('src/data/places.js').write_text(places_js_header + json.dumps(merged, indent=2, ensure_ascii=False) + ';\n' + get_is_open_now_code, encoding='utf-8')
print('Successfully saved to src/data/places.js and api/demo_places.json')
