// Regression check — make sure the original mock-FIR name patterns still
// extract correctly after the PERSON NER rewrite. These mimic the text
// that used to appear in the EAGLE CLAW / BLACK MIRROR narratives.

import { runNER } from '../src/lib/tracex/extraction';

const samples = [
  // original mock-style triggers
  `The accused Rohit Sethi was seen near the godown. Namely Kabir Nanda, director of the front company. The proprietor Imran Qureshi transferred funds.`,
  // labelled fields (new style)
  `Name: Meera Iyer\nFather's Name: Shri Suresh Iyer\nComplainant: Ananya Joshi\nInvestigating Officer: Inspector Devendra Rathore, Economic Offences Wing.`,
  // numbered accused list
  `1. Sameer Qureshi, Proprietor, BluePeak Logistics.\n2. Rohan Bedi, Warehouse Coordinator, BluePeak Logistics.\n3. Ananya Joshi, Accounts Executive, Kaveri Imports.`,
  // explicit entity list
  `PERSON: Meera Iyer, Sameer Qureshi, Rohan Bedi, Ananya Joshi, Devendra Rathore.`,
  // junk that must NOT be captured (false-positive guards)
  `BluePeak Logistics Pvt. Ltd. is located at Sitapura Industrial Area. The warehouse coordinator was present. Section 318 applies. Date 28.08.2026.`,
];

for (let i = 0; i < samples.length; i++) {
  const ents = runNER(samples[i]);
  const persons = ents.filter(e => e.type === 'PERSON').map(e => e.text);
  console.log(`\n--- sample ${i + 1} ---`);
  console.log('text:', samples[i].replace(/\n/g, ' | ').slice(0, 120));
  console.log('PERSONS:', persons.length ? persons.join(', ') : '(none)');
}
