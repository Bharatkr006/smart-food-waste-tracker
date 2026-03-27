import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Vite issue with Leaflet's default marker icons
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl,
    shadowUrl: iconShadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

const MapComponent = ({ listings }) => {
  // Default center coordinates (New Delhi)
  // If the user wants actual locations later, these can be replaced by device gelocation or DB values
  const defaultCenter = [28.6139, 77.2090]; 

  return (
    <div style={{ 
      height: '400px', 
      width: '100%', 
      borderRadius: 'var(--radius-md)', 
      overflow: 'hidden', 
      marginBottom: '2rem', 
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <MapContainer center={defaultCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {listings.map((item) => {
          const lat = item.location?.lat || defaultCenter[0];
          const lng = item.location?.lng || defaultCenter[1];

          return (
            <Marker key={item.id} position={[lat, lng]}>
              <Popup>
                <div style={{fontFamily: 'var(--font-family)', fontSize: '0.875rem'}}>
                  <strong style={{color: 'var(--text-main)', fontSize: '1rem', display: 'block', marginBottom: '4px'}}>{item.title}</strong>
                  <span style={{color: 'var(--text-muted)'}}>{item.quantity} portions</span><br/>
                  <span style={{color: 'var(--primary)', fontWeight: '500'}}>From {item.hostelName}</span>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default MapComponent;
