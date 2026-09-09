import { SPECIAL_TYPES } from './sim.js';

export const TOOL_GROUPS = [
  { id: 'zone', label: 'Zones', art: 'zone', hasDensity: true, tools: ['residential', 'commercial', 'industrial', 'airport', 'seaport'] },
  { id: 'land', label: 'Land', art: 'landscape', sections: [
    { id: 'terrain', label: 'Terrain', tools: ['raise', 'lower', 'level', 'makeland', 'makewater', 'tree'] },
    { id: 'demolition', label: 'Demolition', tools: ['bulldoze'] },
  ] },
  { id: 'transport', label: 'Transport', art: 'transport', tools: ['road', 'highway', 'onramp', 'rail', 'railstation', 'subway', 'substation', 'bus'] },
  { id: 'utilities', label: 'Utilities', art: 'power', sections: [
    { id: 'electricity', label: 'Electricity', tools: ['coal', 'oil', 'gas', 'nuclear', 'wind', 'solar', 'microwave', 'fusion', 'powerline'] },
    { id: 'water', label: 'Water', tools: ['waterpump', 'watertower', 'treatment', 'desalination', 'pipe'] },
    { id: 'waste', label: 'Waste', tools: ['landfill', 'incinerator', 'recycling', 'wasteenergy'] },
  ] },
  { id: 'buildings', label: 'Buildings', art: 'civic', sections: [
    { id: 'services', label: 'Services', tools: ['police', 'fire', 'hospital', 'school', 'college', 'library', 'museum', 'jail'] },
    { id: 'parks', label: 'Parks', tools: ['park', 'largepark', 'zoo'] },
    { id: 'landmarks', label: 'Landmarks', tools: ['clocktower', 'operahouse', 'observatory', 'cathedral', 'aquarium'] },
    { id: 'rewards', label: 'Rewards & deals', tools: SPECIAL_TYPES },
  ] },
  { id: 'emergency', label: 'Emergency', art: 'emergency', tools: ['dispatch', 'patrol'] },
].map(group => ({ ...group, tools: group.tools || group.sections.flatMap(section => section.tools) }));
