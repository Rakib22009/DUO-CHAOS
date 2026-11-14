import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  CarryObjectType,
  CharacterId,
  CourseThemeId,
  OutfitId,
  UserProfile,
} from '../shared/gameTypes';

const app = initializeApp(firebaseConfig);
const firestoreDatabaseId =
  (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId ||
  'ai-studio-c12fabeb-6604-470a-87a1-f25cf9b25973';

export const db = getFirestore(app, firestoreDatabaseId);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/tasks');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export function initAuth(
  onAuthUser: (user: User | null, hasTasksToken: boolean) => void,
) {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedAccessToken = null;
      onAuthUser(null, false);
    } else if (!isSigningIn) {
      onAuthUser(user, Boolean(cachedAccessToken));
    }
  });
}

export async function googleSignIn(): Promise<{ user: User; accessToken: string | null }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export function getAccessToken(): string | null {
  return cachedAccessToken;
}

export async function logout() {
  cachedAccessToken = null;
  await auth.signOut();
}

export async function loadOrCreateUserProfile(user: User): Promise<UserProfile> {
  const userPath = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return {
        uid: data.uid,
        username: data.username,
        photoURL: data.photoURL || '',
        characterId: data.characterId || 'ranger',
        outfitId: data.outfitId || 'trail',
        colorHex: data.colorHex || '#1E5631',
        gamesPlayed: Number(data.gamesPlayed || 0),
        wins: Number(data.wins || 0),
        failures: Number(data.failures || 0),
        bestLevel: Number(data.bestLevel || 0),
      };
    }

    const cleanName = (user.displayName || 'Explorer').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 24) || 'Explorer';
    const initialProfile = {
      uid: user.uid,
      username: cleanName.length >= 2 ? cleanName : 'Explorer',
      photoURL: (user.photoURL || '').slice(0, 512),
      characterId: 'ranger' as CharacterId,
      outfitId: 'trail' as OutfitId,
      colorHex: '#1E5631',
      gamesPlayed: 0,
      wins: 0,
      failures: 0,
      bestLevel: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, initialProfile);
    return {
      uid: initialProfile.uid,
      username: initialProfile.username,
      photoURL: initialProfile.photoURL,
      characterId: initialProfile.characterId,
      outfitId: initialProfile.outfitId,
      colorHex: initialProfile.colorHex,
      gamesPlayed: 0,
      wins: 0,
      failures: 0,
      bestLevel: 0,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }
}

export async function updateUserProfileDoc(
  uid: string,
  updates: Partial<Pick<UserProfile, 'username' | 'characterId' | 'outfitId' | 'colorHex' | 'gamesPlayed' | 'wins' | 'failures' | 'bestLevel'>>,
) {
  const userPath = `users/${uid}`;
  try {
    const ref = doc(db, 'users', uid);
    const sanitized: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.username !== undefined) {
      sanitized.username = updates.username.trim().slice(0, 24);
    }
    if (updates.characterId !== undefined) sanitized.characterId = updates.characterId;
    if (updates.outfitId !== undefined) sanitized.outfitId = updates.outfitId;
    if (updates.colorHex !== undefined) sanitized.colorHex = updates.colorHex;
    if (updates.gamesPlayed !== undefined) sanitized.gamesPlayed = updates.gamesPlayed;
    if (updates.wins !== undefined) sanitized.wins = updates.wins;
    if (updates.failures !== undefined) sanitized.failures = updates.failures;
    if (updates.bestLevel !== undefined) sanitized.bestLevel = updates.bestLevel;
    await updateDoc(ref, sanitized);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, userPath);
  }
}

export interface FirestoreRoomDoc {
  roomId: string;
  hostUid: string;
  hostName: string;
  guestUid: string;
  guestName: string;
  isPublic: boolean;
  roomStatus: 'waiting' | 'playing' | 'completed';
  selectedObject: CarryObjectType;
  courseTheme: CourseThemeId;
  currentLevel: number;
  currentCheckpoint: number;
}

export async function createFirestoreRoom(params: {
  roomId: string;
  hostUid: string;
  hostName: string;
  isPublic: boolean;
  selectedObject: CarryObjectType;
  courseTheme: CourseThemeId;
}) {
  const roomPath = `rooms/${params.roomId}`;
  try {
    await setDoc(doc(db, 'rooms', params.roomId), {
      roomId: params.roomId,
      hostUid: params.hostUid,
      hostName: params.hostName.slice(0, 24) || 'Host',
      guestUid: '',
      guestName: '',
      isPublic: params.isPublic,
      roomStatus: 'waiting',
      selectedObject: params.selectedObject,
      courseTheme: params.courseTheme,
      currentLevel: 1,
      currentCheckpoint: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, roomPath);
  }
}

export async function joinFirestoreRoom(
  roomId: string,
  guestUid: string,
  guestName: string,
): Promise<FirestoreRoomDoc> {
  const cleanId = roomId.toUpperCase().trim();
  const roomPath = `rooms/${cleanId}`;
  try {
    const ref = doc(db, 'rooms', cleanId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error('Room not found. Check the 6-character Room ID.');
    }
    const data = snap.data() as FirestoreRoomDoc;
    if (data.roomStatus !== 'waiting') {
      throw new Error('That room is already in progress or completed.');
    }
    if (data.guestUid && data.guestUid !== guestUid) {
      throw new Error('Room already has 2 players.');
    }
    if (data.hostUid !== guestUid && data.guestUid !== guestUid) {
      await updateDoc(ref, {
        guestUid,
        guestName: guestName.slice(0, 24) || 'Guest',
        updatedAt: serverTimestamp(),
      });
      data.guestUid = guestUid;
      data.guestName = guestName.slice(0, 24) || 'Guest';
    }
    return data;
  } catch (err) {
    if (err instanceof Error && err.message.includes('Room')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.UPDATE, roomPath);
  }
}

export async function findOpenPublicRoom(currentUid: string): Promise<FirestoreRoomDoc | null> {
  const path = 'rooms';
  try {
    const q = query(
      collection(db, 'rooms'),
      where('isPublic', '==', true),
      where('roomStatus', '==', 'waiting'),
      limit(10),
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data() as FirestoreRoomDoc;
      if (!data.guestUid && data.hostUid !== currentUid) {
        return data;
      }
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function updateFirestoreRoomProgress(
  roomId: string,
  updates: Partial<Pick<FirestoreRoomDoc, 'roomStatus' | 'selectedObject' | 'courseTheme' | 'currentLevel' | 'currentCheckpoint'>>,
) {
  const roomPath = `rooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    // Non-fatal if guest or already completed
    console.warn('Room progress sync skipped:', roomPath, err);
  }
}

export async function deleteFirestoreRoom(roomId: string) {
  const roomPath = `rooms/${roomId}`;
  try {
    await deleteDoc(doc(db, 'rooms', roomId));
  } catch (err) {
    console.warn('Room delete skipped:', roomPath, err);
  }
}

export async function saveMatchRecordDoc(params: {
  roomId: string;
  hostUid: string;
  guestUid: string;
  objectType: CarryObjectType;
  courseTheme: CourseThemeId;
  outcome: 'victory' | 'abandoned' | 'failed';
  durationSec: number;
  checkpointsReached: number;
}) {
  const matchId = `${params.roomId}_${Date.now()}`;
  const path = `matches/${matchId}`;
  try {
    await setDoc(doc(db, 'matches', matchId), {
      matchId,
      roomId: params.roomId,
      hostUid: params.hostUid,
      guestUid: params.guestUid,
      objectType: params.objectType,
      courseTheme: params.courseTheme,
      outcome: params.outcome,
      durationSec: Math.round(params.durationSec),
      checkpointsReached: params.checkpointsReached,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export interface MatchHistoryItem {
  matchId: string;
  roomId: string;
  objectType: string;
  courseTheme: string;
  outcome: string;
  durationSec: number;
  checkpointsReached: number;
}

export async function fetchUserMatches(uid: string): Promise<MatchHistoryItem[]> {
  const path = 'matches';
  try {
    const qHost = query(
      collection(db, 'matches'),
      where('hostUid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(10),
    );
    const snap = await getDocs(qHost);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        matchId: data.matchId,
        roomId: data.roomId,
        objectType: data.objectType,
        courseTheme: data.courseTheme,
        outcome: data.outcome,
        durationSec: Number(data.durationSec || 0),
        checkpointsReached: Number(data.checkpointsReached || 0),
      };
    });
  } catch (err) {
    console.warn('Match history query fallback:', err);
    return [];
  }
}
