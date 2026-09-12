// LA 311 (MyLA311) service catalog.
//
// `code` values follow the Open311 GeoReport v2 service_code convention used by
// the City of Los Angeles. They are centralized here so they can be verified /
// updated against the live service-discovery endpoint (GET /services.json)
// without touching UI or API code.

export type ServiceField = {
  key: string
  label: string
  /** open311 attribute code, if this maps to a service-definition attribute */
  attributeCode?: string
  type: 'text' | 'textarea' | 'number' | 'select'
  placeholder?: string
  options?: string[]
  required?: boolean
}

export type Service = {
  code: string
  name: string
  /** Short line shown under the name. */
  summary: string
  /** Longer guidance used by the AI classifier to match intent. */
  guidance: string
  /** lucide-react icon name */
  icon: string
  keywords: string[]
  fields?: ServiceField[]
}

export const SERVICES: Service[] = [
  {
    code: 'BULKYITEM',
    name: 'Bulky Item Pickup',
    summary: 'Couches, mattresses, furniture and large household items',
    guidance:
      'Free pickup of oversized household items left at the curb such as sofas, mattresses, tables, chairs, carpet rolls and box springs.',
    icon: 'Sofa',
    keywords: ['couch', 'sofa', 'mattress', 'furniture', 'table', 'chair', 'bulky', 'box spring', 'carpet'],
    fields: [
      { key: 'itemCount', label: 'Number of items', type: 'number', placeholder: 'e.g. 2' },
      { key: 'itemDescription', label: 'What items?', type: 'text', placeholder: 'e.g. one couch, one mattress' },
    ],
  },
  {
    code: 'ILLEGALDUMPINGPICKUP',
    name: 'Illegal Dumping',
    summary: 'Trash, debris or waste dumped in public spaces',
    guidance:
      'Removal of trash, construction debris, tires, or other waste illegally dumped on sidewalks, alleys, parkways or vacant lots.',
    icon: 'Trash2',
    keywords: ['dumping', 'trash pile', 'debris', 'garbage', 'waste', 'tires', 'dumped', 'litter', 'alley'],
    fields: [
      { key: 'itemDescription', label: 'What was dumped?', type: 'text', placeholder: 'e.g. bags of trash, construction debris' },
    ],
  },
  {
    code: 'METALHOUSEHOLDAPPLIANCES',
    name: 'Metal & Household Appliances',
    summary: 'Refrigerators, stoves, washers and other appliances',
    guidance:
      'Pickup of large metal items and appliances such as refrigerators, stoves, washing machines, dryers and water heaters.',
    icon: 'WashingMachine',
    keywords: ['refrigerator', 'fridge', 'stove', 'washer', 'dryer', 'appliance', 'metal', 'water heater', 'oven'],
    fields: [
      { key: 'itemDescription', label: 'Which appliance(s)?', type: 'text', placeholder: 'e.g. refrigerator' },
    ],
  },
  {
    code: 'ELECTRONICWASTE',
    name: 'Electronic Waste',
    summary: 'TVs, computers, monitors and other electronics',
    guidance:
      'Pickup of electronic waste such as televisions, computers, monitors, printers and other electronics.',
    icon: 'Tv',
    keywords: ['tv', 'television', 'computer', 'monitor', 'printer', 'electronic', 'e-waste', 'laptop'],
    fields: [
      { key: 'itemDescription', label: 'Which electronics?', type: 'text', placeholder: 'e.g. old TV and a monitor' },
    ],
  },
  {
    code: 'GRAFFITIREMOVAL',
    name: 'Graffiti Removal',
    summary: 'Graffiti or tagging on walls, signs or property',
    guidance:
      'Removal of graffiti and tagging from walls, fences, poles, signs, sidewalks and other public or visible surfaces.',
    icon: 'SprayCan',
    keywords: ['graffiti', 'tagging', 'tag', 'spray paint', 'vandalism', 'defaced'],
    fields: [
      {
        key: 'surface',
        label: 'Surface type',
        type: 'select',
        options: ['Wall', 'Fence', 'Sidewalk', 'Pole / sign', 'Other'],
      },
    ],
  },
  {
    code: 'POTHOLE',
    name: 'Pothole / Street Damage',
    summary: 'Potholes and damaged road surfaces',
    guidance:
      'Repair of potholes, cracked or damaged street surfaces and sunken pavement on public roadways.',
    icon: 'Construction',
    keywords: ['pothole', 'road', 'street damage', 'pavement', 'crack', 'sinkhole', 'asphalt'],
    fields: [
      { key: 'laneLocation', label: 'Where on the road?', type: 'text', placeholder: 'e.g. right lane near the crosswalk' },
    ],
  },
  {
    code: 'SINGLESTREETLIGHT',
    name: 'Streetlight Out',
    summary: 'A single streetlight that is out or damaged',
    guidance:
      'Report a single streetlight that is not working, flickering, staying on during the day, or physically damaged.',
    icon: 'Lightbulb',
    keywords: ['streetlight', 'street light', 'light out', 'lamp post', 'flickering', 'dark street'],
    fields: [
      { key: 'poleId', label: 'Pole number (if visible)', type: 'text', placeholder: 'Optional' },
    ],
  },
  {
    code: 'DEADANIMALREMOVAL',
    name: 'Dead Animal Removal',
    summary: 'Dead animal in the street or public area',
    guidance:
      'Removal of a dead animal from a street, sidewalk, alley or other public area.',
    icon: 'PawPrint',
    keywords: ['dead animal', 'dead dog', 'dead cat', 'carcass', 'roadkill', 'animal remains'],
    fields: [
      { key: 'animalType', label: 'Type of animal', type: 'text', placeholder: 'e.g. dog, cat, raccoon' },
    ],
  },
  {
    code: 'HOMELESSENCAMPMENT',
    name: 'Homeless Encampment',
    summary: 'Report an encampment for outreach and cleanup',
    guidance:
      'Report a homeless encampment so the city can coordinate outreach services and cleanup. This connects people with resources.',
    icon: 'Tent',
    keywords: ['encampment', 'homeless', 'tents', 'unhoused', 'camp'],
    fields: [
      { key: 'sizeEstimate', label: 'Approx. number of tents / people', type: 'text', placeholder: 'Optional' },
    ],
  },
  {
    code: 'OTHER',
    name: 'Something Else',
    summary: "Report another issue — we'll route it for you",
    guidance:
      'A general or uncategorized request. Use when the issue does not clearly match another service type.',
    icon: 'CircleHelp',
    keywords: ['other', 'general', 'help', 'question', 'misc'],
  },
]

export function getService(code: string): Service | undefined {
  return SERVICES.find((s) => s.code === code)
}

export const SERVICE_CODES = SERVICES.map((s) => s.code)
