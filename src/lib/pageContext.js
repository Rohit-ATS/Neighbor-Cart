import { useEffect, useState } from 'react';

/* What the navigator knows about the page it is floating over.

   Every section of the site carries a `data-ai-section` attribute. Clicking
   anywhere inside one tells the launcher which part of the product the person
   is actually looking at, and that entry travels with the question: the label
   shows on the button, the starters replace the generic prompts, and the
   summary is handed to the model so "what is this?" has an answer.

   `explainer` is the same knowledge written out for a person. The offline
   matcher falls back to it when the hosted model is unavailable, so the
   assistant still answers a question about the section it is sitting on. */

export const SECTION_KNOWLEDGE = {
  /* ---- landing page ---- */
  top: {
    label: 'Home',
    summary:
      'The visitor is on the Neighbor Cart home page: a free, nationwide directory of food banks, pantries, hot meal programs and 24/7 community fridges, with live hours and no account or paperwork required.',
    explainer:
      'You’re on the Neighbor Cart home page. We map verified food banks, pantries, hot meal programs and 24/7 community fridges across the country — with real open hours and live inventory. It is free, no account is needed, and nothing here asks for documents.',
    starters: [
      { label: 'What is this?', prompt: 'What is Neighbor Cart and who is it for?' },
      { label: 'Open right now', prompt: 'What food assistance is open right now?' },
      { label: 'Do I need ID?', prompt: 'Do I need an ID or paperwork to get food here?' },
    ],
  },
  how: {
    label: 'How it works',
    summary:
      'The visitor is reading the three-step "How it works" section: 1) tell us where you are, a ZIP code is enough, no account or eligibility quiz; 2) see what is open now, with live hours, current inventory and dietary notes; 3) go, or reserve a pickup slot ahead of time.',
    explainer:
      'Three steps, that’s all. First you tell us roughly where you are — a ZIP code is enough, with no account and no eligibility quiz. Then you see what is open right now, with live hours, current stock and dietary notes for every nearby pantry, kitchen and fridge. Then you either go, or hold a pickup slot so your food is waiting for you.',
    starters: [
      { label: 'Walk me through it', prompt: 'Walk me through how to find food here, step by step.' },
      { label: 'Just a ZIP code?', prompt: 'Is a ZIP code really all I need to get started?' },
      { label: 'Reserve a slot', prompt: 'How does reserving a pickup slot ahead of time work?' },
    ],
  },
  reel: {
    label: 'What you find',
    summary:
      'The visitor is reading the "What you find" section, which covers the kinds of food available: fresh produce picked up from farms and grocers the same morning, hot meals served with no questions asked, and community fridges open 24/7.',
    explainer:
      'Not a shelf of dented cans. You’ll find fresh produce collected from farms and grocers the same morning, hot meals served with no questions asked, and community fridges you can open at any hour — each listed with what is actually in stock.',
    starters: [
      { label: 'Fresh produce', prompt: 'Which places near me have fresh produce in stock?' },
      { label: 'Hot meals', prompt: 'Where can I get a free hot meal today?' },
      { label: '24/7 fridges', prompt: 'Where are the community fridges that are open 24/7?' },
    ],
  },
  places: {
    label: 'Places near you',
    summary:
      'The visitor is looking at the sample of verified nearby locations on the home page, each showing a live open/closed pill, city and tags such as fresh produce, no ID required, self-serve, Halal options or family friendly. The full map holds thousands more.',
    explainer:
      'These are a handful of verified locations, each with a live open pill and tags like "no ID required" or "Halal options". The full map has thousands more — tell me your city or ZIP and I’ll narrow it to what fits you.',
    starters: [
      { label: 'Near my ZIP', prompt: 'What verified food places are near my ZIP code?' },
      { label: 'No ID required', prompt: 'Which nearby places need no ID at all?' },
      { label: 'Halal options', prompt: 'Where can I get Halal food with no ID required?' },
    ],
  },
  about: {
    label: 'About & impact',
    summary:
      'The visitor is reading the impact numbers: over 2,400 verified locations nationwide, 100% free to use, zero documents required to start, and 24/7 community fridges listed. Listings are community-verified and people are asked to call ahead to confirm hours.',
    explainer:
      'Neighbor Cart lists over 2,400 verified locations nationwide. It is always free, nothing requires documents to start, and community fridges are listed for any hour of the day. Listings are community-verified, so it is still worth calling ahead to confirm hours.',
    starters: [
      { label: 'How is it verified?', prompt: 'How are these locations verified, and how current is the information?' },
      { label: 'Is it really free?', prompt: 'Is Neighbor Cart really free, and is my information private?' },
      { label: 'Find food now', prompt: 'Help me find verified food assistance near me right now.' },
    ],
  },

  /* ---- the places workspace ---- */
  directory: {
    label: 'Map & directory',
    summary:
      'The visitor is in the map and directory workspace, filtering verified locations by category, open-now, reservations, fresh produce, dietary needs, language and eligibility, with results shown both as cards and as pins on an interactive map.',
    explainer:
      'This is the live directory. Filter by what is open now, by diet, by language spoken, by eligibility rules or by whether they take reservations — the map and the cards stay in step. Tell me what you need and I’ll narrow it for you and drop the matches on the map.',
    starters: [
      { label: 'Filter for me', prompt: 'Narrow the directory to places that are open right now near me.' },
      { label: 'Takes reservations', prompt: 'Which nearby places let me reserve a pickup slot?' },
      { label: 'No car needed', prompt: 'Free pantries reachable by public transit near me?' },
    ],
  },
  intake: {
    label: 'Personalized food plan',
    summary:
      'The visitor has opened the personalized food plan intake, which collects household size, dietary needs, language, transport and eligibility concerns in order to build a tailored list of food resources.',
    explainer:
      'The personalized plan asks a few questions — household size, diet, language, how you travel, any ID worries — and turns them into a short list made for your situation. You can also just tell me those things here and I’ll remember them for every search you make.',
    starters: [
      { label: 'What is it for?', prompt: 'What does the personalized food plan do with my answers?' },
      { label: 'Feeding a family', prompt: 'I am feeding a family of five — what should my plan include?' },
      { label: 'Is it private?', prompt: 'Is anything I enter in the personalized plan stored or shared?' },
    ],
  },
  community: {
    label: 'Community feed',
    summary:
      'The visitor has opened the community feed, where neighbors post live updates about pantries — restocks, closures, long lines, changed hours — and can report a listing for administrator verification.',
    explainer:
      'The community feed is where neighbors post what they just saw: a restock, a surprise closure, a long line, a changed hour. You can report a listing from here too, and an administrator checks it before the directory changes.',
    starters: [
      { label: 'Latest updates', prompt: 'What have neighbors reported recently about pantries near me?' },
      { label: 'Report a change', prompt: 'How do I report that a pantry’s hours or stock have changed?' },
      { label: 'Is it trustworthy?', prompt: 'How are community reports verified before they change a listing?' },
    ],
  },
  volunteer: {
    label: 'Volunteer shifts',
    summary:
      'The visitor has opened the volunteer hub, which lists open shifts at partner pantries, kitchens and distributions that a person can sign up for.',
    explainer:
      'The volunteer hub lists open shifts at partner pantries, kitchens and distributions — sorting, packing, driving, serving. Pick one that fits your week and sign up; most need no experience at all.',
    starters: [
      { label: 'Open shifts', prompt: 'What volunteer shifts are open near me this week?' },
      { label: 'What would I do?', prompt: 'What does a volunteer actually do on a shift?' },
      { label: 'Any requirements?', prompt: 'Do I need training or a background check to volunteer?' },
    ],
  },
  rescue: {
    label: 'Food rescue dispatch',
    summary:
      'The visitor has opened the food rescue dispatch, which routes surplus food from grocers, farms and restaurants to nearby pantries and kitchens before it is wasted.',
    explainer:
      'Food rescue moves surplus from grocers, farms and restaurants to pantries and kitchens before it goes to waste. Businesses post what they have, drivers claim a run, and the food lands somewhere it is needed the same day.',
    starters: [
      { label: 'How it works', prompt: 'How does food rescue dispatch move surplus food to pantries?' },
      { label: 'Donate surplus', prompt: 'I run a grocery store with surplus food — how do I donate it?' },
      { label: 'Drive a run', prompt: 'How do I sign up to drive a food rescue run?' },
    ],
  },
  nonprofit: {
    label: 'Nonprofit portal',
    summary:
      'The visitor has opened the nonprofit portal, where partner organizations manage their listing: hours, inventory, reservation slots and the dietary and eligibility details residents see.',
    explainer:
      'The nonprofit portal is for partner organizations. It is where a pantry keeps its hours, inventory, pickup slots and dietary notes current — which is what makes the resident-facing listings trustworthy.',
    starters: [
      { label: 'Join as a partner', prompt: 'How does a pantry or nonprofit get listed on Neighbor Cart?' },
      { label: 'Update a listing', prompt: 'How do partner organizations update their hours and inventory?' },
      { label: 'What it costs', prompt: 'Is there any cost for a nonprofit to use this portal?' },
    ],
  },
  impact: {
    label: 'Impact dashboard',
    summary:
      'The visitor has opened the impact dashboard, which reports aggregate outcomes across the network: meals served, pounds of food rescued, locations verified and neighbors reached.',
    explainer:
      'The impact dashboard totals what the network has done: meals served, pounds of food rescued from waste, locations verified and neighbors reached. It is aggregate only — no individual visit is ever shown.',
    starters: [
      { label: 'Explain the numbers', prompt: 'What do the numbers on the impact dashboard measure?' },
      { label: 'Where it comes from', prompt: 'Where does the impact data come from and how often is it updated?' },
      { label: 'My privacy', prompt: 'Does the impact dashboard track individual people or visits?' },
    ],
  },
  admin: {
    label: 'Admin verification',
    summary:
      'The visitor has opened the admin verification portal, where administrators review community reports and confirm or correct listing details before they reach residents.',
    explainer:
      'This is where administrators review what the community reports — a closure, a wrong hour, a listing that needs a second look — and confirm or correct it before residents ever see the change.',
    starters: [
      { label: 'Review queue', prompt: 'What happens to a reported listing in the verification queue?' },
      { label: 'Verification rules', prompt: 'What standard does a listing have to meet to be marked verified?' },
      { label: 'Report an error', prompt: 'I found wrong information in a listing — how do I report it?' },
    ],
  },
  passes: {
    label: 'Your pickup passes',
    summary:
      'The visitor is looking at their saved pickup passes: reserved slots with a code, date, time, location and household details, saved to this browser and shown on arrival for a discreet pickup.',
    explainer:
      'These are your reserved pickup passes — a code, a date and time, and the location. Show the code when you arrive; nobody has to ask you anything. They are saved to this browser only, so they stay private to you.',
    starters: [
      { label: 'Using a pass', prompt: 'What do I do with my pickup pass when I arrive?' },
      { label: 'Change a time', prompt: 'How do I change or cancel a pickup slot I reserved?' },
      { label: 'Where are they saved?', prompt: 'Where are my pickup passes stored, and can anyone else see them?' },
    ],
  },
  reservation: {
    label: 'Reserve a pickup',
    summary:
      'The visitor is filling out a pickup reservation: choosing a date and time slot at a specific verified location, and noting household size and dietary needs so the right box is set aside.',
    explainer:
      'Reserving holds a pickup slot at a specific place, with your household size and dietary needs noted so the right box is set aside. You get a code to show on arrival — no explaining, no waiting in line.',
    starters: [
      { label: 'Why reserve?', prompt: 'Why would I reserve a pickup slot instead of just walking in?' },
      { label: 'What to bring', prompt: 'What do I need to bring to a reserved pickup?' },
      { label: 'If I miss it', prompt: 'What happens if I miss my reserved pickup time?' },
    ],
  },
  'place-detail': {
    label: 'Place details',
    summary:
      'The visitor has opened a single location’s detail view: its address, published hours, current inventory by category, dietary and eligibility notes, transit directions and phone number.',
    explainer:
      'This is everything we have verified about one location: address, published hours, what is in stock by category, dietary and eligibility notes, how to get there without a car, and a number to call ahead.',
    starters: [
      { label: 'Getting there', prompt: 'How do I get to this place without a car?' },
      { label: 'What to expect', prompt: 'What should I expect on my first visit to this place?' },
      { label: 'Similar places', prompt: 'Show me other verified places like this one nearby.' },
    ],
  },
};

export const DEFAULT_SECTION = 'top';

export function getSectionKnowledge(sectionId) {
  return SECTION_KNOWLEDGE[sectionId] || SECTION_KNOWLEDGE[DEFAULT_SECTION];
}

/* Follows the person around the page.

   A click inside any `data-ai-section` wins, because it is the most direct
   statement of what they are looking at. `activeId` is whatever the host
   screen already tracks — scroll position on the landing page, the open panel
   in the workspace — and it takes over again the moment it changes, so the
   context never gets stuck on a section that has scrolled away. */
export function useSectionContext(activeId = DEFAULT_SECTION) {
  const [clicked, setClicked] = useState(null);

  useEffect(() => { setClicked(null); }, [activeId]);

  useEffect(() => {
    const onPointerDown = (event) => {
      const host = event.target?.closest?.('[data-ai-section]');
      if (host?.dataset.aiSection) setClicked(host.dataset.aiSection);
    };
    // Capture, so a section is still registered when the click lands on a
    // control that stops propagation on its way up.
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  return clicked || activeId || DEFAULT_SECTION;
}
