export function selectDish(dishes, previousId, random = Math.random) {
  const unique = [...new Map(dishes.map(dish => [dish.id, dish])).values()];
  const candidates = unique.length > 1 ? unique.filter(dish => dish.id !== previousId) : unique;
  if (!candidates.length) return null;
  return candidates[Math.floor(random() * candidates.length)];
}

export function animationDelays() {
  return [55, 55, 55, 55, 55, 55, 55, 65, 70, 80, 95, 110, 130, 150, 180, 215, 260, 310, 390];
}
