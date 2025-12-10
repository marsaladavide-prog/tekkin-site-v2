"use client";

import { useEffect, useState } from "react";

type ProfileMe = {
  id: string;
};

type ProfileCacheState = {
  promise?: Promise<ProfileMe | null>;
  data?: ProfileMe | null;
};

const profileCache: ProfileCacheState = {};

async function fetchProfile(): Promise<ProfileMe | null> {
  try {
    const res = await fetch("/api/profile/me");
    if (!res.ok) {
      return null;
    }

    const data = (await res.json().catch(() => null)) as
      | ProfileMe
      | null;

    return data;
  } catch {
    return null;
  }
}

function ensureProfileCached(): Promise<ProfileMe | null> {
  if (!profileCache.promise) {
    profileCache.promise = fetchProfile().then((payload) => {
      profileCache.data = payload;
      return payload;
    });
  }
  return profileCache.promise;
}

export function useProfileMe() {
  const [profile, setProfile] = useState<ProfileMe | null | undefined>(
    profileCache.data
  );
  const [loading, setLoading] = useState<boolean>(
    profileCache.data === undefined && !profileCache.promise
  );

  useEffect(() => {
    let cancelled = false;

    ensureProfileCached()
      .then((payload) => {
        if (!cancelled) {
          setProfile(payload);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProfile(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    profile,
    loading,
  };
}
