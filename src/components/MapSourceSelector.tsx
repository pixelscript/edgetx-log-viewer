import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../state/store';
import { mapSources } from '../consts/mapSources';
import { setSelectedMapSourceId, selectSelectedMapSourceId } from '../state/uiSlice';

export const MapSourceSelector: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const selectedId = useSelector(selectSelectedMapSourceId);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(setSelectedMapSourceId(event.target.value));
  };

  return (
    <div style={{ margin: '10px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
      <label htmlFor="map-source-selector" style={{ marginRight: '10px' }}>Map Source:</label>
      <select
        id="map-source-selector"
        value={selectedId}
        onChange={handleChange}
        style={{ padding: '8px', borderRadius: '4px' }}
      >
        {mapSources.map((source) => (
          <option key={source.id} value={source.id}>
            {source.name}
          </option>
        ))}
      </select>
    </div>
  );
};