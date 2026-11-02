/** Layer IDs used by HotspotMapLayer — kept in a separate file so
 *  react-fast-refresh's "only-export-components" rule is satisfied.
 *  MapContainer imports this directly rather than going through HotspotMapLayer.
 */
export const HOTSPOT_INTERACTIVE_LAYERS = [
  'hotspot-polygon-fill',
  'hotspot-heat-blob',
  'hotspot-badge-bg',
] as const;

