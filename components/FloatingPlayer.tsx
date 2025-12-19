import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useRecoilState } from 'recoil';
import { currentTrackIdState, isPlayingState } from '../atoms/musicAtom';
import { fetchSongDetails } from '../utils/api';
import { PlayerControls } from './PlayerControls';

export function FloatingPlayer() {
  const router = useRouter();
  const [currentTrackId, setCurrentTrackId] = useRecoilState(currentTrackIdState);
  const [isPlaying, setIsPlaying] = useRecoilState(isPlayingState);
  const [trackDetails, setTrackDetails] = useState(null);
  const [coverUrl, setCoverUrl] = useState('');

  useEffect(() => {
    const fetchDetails = async () => {
      if (currentTrackId) {
        const details = await fetchSongDetails(currentTrackId);
        setTrackDetails(details);
        setCoverUrl(details.album.cover_medium); // Assicurati che questa sia la giusta proprietà per l'URL della cover
      }
    };

    fetchDetails();
  }, [currentTrackId]);

  // Usa state.coverUrl dove necessario

  return (
    <div className="floating-player">
      {trackDetails && (
        <>
          <img src={coverUrl} alt="Album Cover" className="cover-art" />
          <div className="track-info">
            <h3 className="track-title">{trackDetails.title}</h3>
            <p className="track-artist">{trackDetails.artist.name}</p>
          </div>
          <PlayerControls />
        </>
      )}
    </div>
  );
}