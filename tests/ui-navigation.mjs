export async function openManagement(page, name) {
  await page.getByRole('button', { name: 'City management', exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
}

export async function openCategory(page, name) {
  const route = {
    Civic: ['Buildings', 'Services'],
    Power: ['Utilities', 'Electricity'], Water: ['Utilities', 'Water'],
    Sanitation: ['Utilities', 'Waste'], 'Parks & Land': ['Buildings', 'Parks'],
    Landmarks: ['Buildings', 'Landmarks'], 'Rewards & Deals': ['Buildings', 'Rewards & deals'],
  }[name] || [name];
  await page.getByRole('button', { name: route[0], exact: true }).click();
  if (route[1]) await page.getByRole('tab', { name: route[1], exact: true }).click();
}
