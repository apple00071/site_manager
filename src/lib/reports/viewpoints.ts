// Predefined viewpoints for all projects
export const DEFAULT_VIEWPOINTS = [
    { id: 'vp-living-room', name: 'Living Room', description: 'Main living area view' },
    { id: 'vp-kitchen', name: 'Kitchen', description: 'Kitchen area view' },
    { id: 'vp-master-bedroom', name: 'Master Bedroom', description: 'Master bedroom view' },
    { id: 'vp-bedroom-2', name: 'Bedroom 2', description: 'Second bedroom view' },
    { id: 'vp-bedroom-3', name: 'Bedroom 3', description: 'Third bedroom view' },
    { id: 'vp-bathroom-1', name: 'Bathroom 1', description: 'Main bathroom view' },
    { id: 'vp-bathroom-2', name: 'Bathroom 2', description: 'Second bathroom view' },
    { id: 'vp-balcony', name: 'Balcony', description: 'Balcony/terrace area view' },
    { id: 'vp-entrance', name: 'Entrance/Foyer', description: 'Main entrance view' },
    { id: 'vp-dining', name: 'Dining Area', description: 'Dining area view' },
];

export function getViewpointName(viewpointId: string): string {
    const vp = DEFAULT_VIEWPOINTS.find(v => v.id === viewpointId);
    return vp?.name || 'Viewpoint';
}
