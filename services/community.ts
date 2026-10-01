import { supabase } from '@/services/supabase';
import { CommunityCoach, generateShareCode } from '@/constants/community-coaches';

export function mapCoachFromDB(row: any): CommunityCoach {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    description: row.description,
    specialty: row.specialty,
    tone: row.tone,
    icon: row.icon,
    color: row.color,
    systemPrompt: row.system_prompt,
    downloads: row.downloads ?? 0,
    author: row.author,
    authorId: row.author_id,
    isFeatured: row.is_featured ?? false,
    rating: parseFloat(row.rating) || 0,
    ratingCount: row.rating_count ?? 0,
    shareCode: row.share_code,
  };
}

export function mapCoachToDB(coach: any): Record<string, any> {
  const mapped: Record<string, any> = {};
  if (coach.name !== undefined) mapped.name = coach.name;
  if (coach.role !== undefined) mapped.role = coach.role;
  if (coach.description !== undefined) mapped.description = coach.description;
  if (coach.specialty !== undefined) mapped.specialty = coach.specialty;
  if (coach.tone !== undefined) mapped.tone = coach.tone;
  if (coach.icon !== undefined) mapped.icon = coach.icon;
  if (coach.color !== undefined) mapped.color = coach.color;
  if (coach.systemPrompt !== undefined) mapped.system_prompt = coach.systemPrompt;
  if (coach.downloads !== undefined) mapped.downloads = coach.downloads;
  if (coach.author !== undefined) mapped.author = coach.author;
  if (coach.authorId !== undefined) mapped.author_id = coach.authorId;
  if (coach.isFeatured !== undefined) mapped.is_featured = coach.isFeatured;
  if (coach.rating !== undefined) mapped.rating = coach.rating;
  if (coach.ratingCount !== undefined) mapped.rating_count = coach.ratingCount;
  if (coach.shareCode !== undefined) mapped.share_code = coach.shareCode;
  return mapped;
}

export async function fetchCommunityCoaches(): Promise<CommunityCoach[]> {
  try {
    const { data, error } = await supabase
      .from('community_coaches')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching community coaches:', error);
      return [];
    }

    return (data || []).map(mapCoachFromDB);
  } catch (err) {
    console.error('Error fetching community coaches:', err);
    return [];
  }
}

export async function fetchFeaturedCoaches(): Promise<CommunityCoach[]> {
  try {
    const { data, error } = await supabase
      .from('community_coaches')
      .select('*')
      .eq('is_featured', true);

    if (error) {
      console.error('Error fetching featured coaches:', error);
      return [];
    }

    return (data || []).map(mapCoachFromDB);
  } catch (err) {
    console.error('Error fetching featured coaches:', err);
    return [];
  }
}

export async function fetchPopularCoaches(): Promise<CommunityCoach[]> {
  try {
    const { data, error } = await supabase
      .from('community_coaches')
      .select('*')
      .order('rating', { ascending: false });

    if (error) {
      console.error('Error fetching popular coaches:', error);
      return [];
    }

    return (data || []).map(mapCoachFromDB);
  } catch (err) {
    console.error('Error fetching popular coaches:', err);
    return [];
  }
}

export async function fetchNewestCoaches(): Promise<CommunityCoach[]> {
  try {
    const { data, error } = await supabase
      .from('community_coaches')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching newest coaches:', error);
      return [];
    }

    return (data || []).map(mapCoachFromDB);
  } catch (err) {
    console.error('Error fetching newest coaches:', err);
    return [];
  }
}

export async function searchCoaches(query: string): Promise<CommunityCoach[]> {
  try {
    const searchTerm = `%${query}%`;
    const { data, error } = await supabase
      .from('community_coaches')
      .select('*')
      .or(`name.ilike.${searchTerm},role.ilike.${searchTerm},specialty.ilike.${searchTerm}`);

    if (error) {
      console.error('Error searching coaches:', error);
      return [];
    }

    return (data || []).map(mapCoachFromDB);
  } catch (err) {
    console.error('Error searching coaches:', err);
    return [];
  }
}

export async function shareCoachToCommunity(
  coach: Omit<CommunityCoach, 'id' | 'downloads' | 'rating' | 'ratingCount' | 'isFeatured'> & { shareCode: string }
): Promise<CommunityCoach | null> {
  try {
    const dbCoach = {
      ...mapCoachToDB(coach),
      downloads: 0,
      rating: 0,
      rating_count: 0,
      is_featured: false,
    };

    const { data, error } = await supabase
      .from('community_coaches')
      .insert(dbCoach)
      .select()
      .single();

    if (error) {
      console.error('Error sharing coach to community:', error);
      return null;
    }

    return data ? mapCoachFromDB(data) : null;
  } catch (err) {
    console.error('Error sharing coach to community:', err);
    return null;
  }
}

export async function importCoachByCode(code: string): Promise<CommunityCoach | null> {
  try {
    const { data, error } = await supabase
      .from('community_coaches')
      .select('*')
      .eq('share_code', code)
      .single();

    if (error) {
      console.error('Error importing coach by code:', error);
      return null;
    }

    return data ? mapCoachFromDB(data) : null;
  } catch (err) {
    console.error('Error importing coach by code:', err);
    return null;
  }
}

export async function deleteCommunityCoach(coachId: string, authorId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('community_coaches')
      .delete()
      .eq('id', coachId)
      .eq('author_id', authorId);

    if (error) {
      console.error('Error deleting community coach:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error deleting community coach:', err);
    return false;
  }
}

export async function incrementDownloads(coachId: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('increment_downloads', { coach_id: coachId });

    if (error) {
      const { data: coach, error: fetchError } = await supabase
        .from('community_coaches')
        .select('downloads')
        .eq('id', coachId)
        .single();

      if (fetchError) {
        console.error('Error fetching coach downloads:', fetchError);
        return false;
      }

      const { error: updateError } = await supabase
        .from('community_coaches')
        .update({ downloads: (coach?.downloads || 0) + 1 })
        .eq('id', coachId);

      if (updateError) {
        console.error('Error incrementing downloads:', updateError);
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error('Error incrementing downloads:', err);
    return false;
  }
}

export async function rateCoach(coachId: string, userId: string, rating: number): Promise<boolean> {
  try {
    const { error: upsertError } = await supabase
      .from('coach_ratings')
      .upsert(
        {
          coach_id: coachId,
          user_id: userId,
          rating,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'coach_id,user_id' }
      );

    if (upsertError) {
      console.error('Error upserting coach rating:', upsertError);
      return false;
    }

    const { data: ratings, error: fetchError } = await supabase
      .from('coach_ratings')
      .select('rating')
      .eq('coach_id', coachId);

    if (fetchError) {
      console.error('Error fetching ratings for aggregate:', fetchError);
      return false;
    }

    const ratingCount = ratings?.length || 0;
    const avgRating = ratingCount > 0
      ? ratings!.reduce((sum: number, r: any) => sum + r.rating, 0) / ratingCount
      : 0;

    const { error: updateError } = await supabase
      .from('community_coaches')
      .update({
        rating: Math.round(avgRating * 10) / 10,
        rating_count: ratingCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coachId);

    if (updateError) {
      console.error('Error updating coach aggregate rating:', updateError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error rating coach:', err);
    return false;
  }
}

export async function getUserRating(coachId: string, userId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('coach_ratings')
      .select('rating')
      .eq('coach_id', coachId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching user rating:', error);
      return null;
    }

    return data?.rating ?? null;
  } catch (err) {
    console.error('Error fetching user rating:', err);
    return null;
  }
}

export async function upsertSubscriber(data: {
  userId: string;
  deviceId?: string;
  email?: string;
  displayName?: string;
  tier: string;
  source?: string;
  expiresAt?: string;
}): Promise<any | null> {
  try {
    const record: Record<string, any> = {
      user_id: data.userId,
      subscription_tier: data.tier,
      is_active: true,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (data.deviceId !== undefined) record.device_id = data.deviceId;
    if (data.email !== undefined) record.email = data.email;
    if (data.displayName !== undefined) record.display_name = data.displayName;
    if (data.source !== undefined) record.subscription_source = data.source;
    if (data.expiresAt !== undefined) record.expires_at = data.expiresAt;

    const { data: result, error } = await supabase
      .from('subscribers')
      .upsert(record, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.error('Error upserting subscriber:', error);
      return null;
    }

    return result;
  } catch (err) {
    console.error('Error upserting subscriber:', err);
    return null;
  }
}

export async function getSubscriber(userId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('subscribers')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching subscriber:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error fetching subscriber:', err);
    return null;
  }
}

export async function deactivateSubscriber(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('subscribers')
      .update({
        is_active: false,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error deactivating subscriber:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error deactivating subscriber:', err);
    return false;
  }
}

export async function validateVoucher(code: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error validating voucher:', error);
      return null;
    }

    if (!data) return null;

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return null;
    }

    if (data.max_uses !== null && data.current_uses >= data.max_uses) {
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error validating voucher:', err);
    return null;
  }
}

export async function redeemVoucher(
  code: string,
  userId: string
): Promise<{ success: boolean; message: string; expiresAt?: string }> {
  try {
    const voucher = await validateVoucher(code);
    if (!voucher) {
      return { success: false, message: 'Invalid or expired voucher code.' };
    }

    const { data: existing, error: checkError } = await supabase
      .from('voucher_redemptions')
      .select('id')
      .eq('voucher_id', voucher.id)
      .eq('user_id', userId)
      .single();

    if (existing) {
      return { success: false, message: 'You have already redeemed this voucher.' };
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (voucher.duration_days || 30));
    const expiresAtStr = expiresAt.toISOString();

    const { error: redemptionError } = await supabase
      .from('voucher_redemptions')
      .insert({
        voucher_id: voucher.id,
        user_id: userId,
        redeemed_at: new Date().toISOString(),
        subscription_granted_until: expiresAtStr,
      });

    if (redemptionError) {
      console.error('Error creating voucher redemption:', redemptionError);
      return { success: false, message: 'Failed to redeem voucher. Please try again.' };
    }

    const { error: updateError } = await supabase
      .from('vouchers')
      .update({
        current_uses: (voucher.current_uses || 0) + 1,
      })
      .eq('id', voucher.id);

    if (updateError) {
      console.error('Error incrementing voucher uses:', updateError);
    }

    await upsertSubscriber({
      userId,
      tier: 'pro',
      source: 'voucher',
      expiresAt: expiresAtStr,
    });

    const { error: voucherCodeError } = await supabase
      .from('subscribers')
      .update({ voucher_code: code, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (voucherCodeError) {
      console.error('Error updating subscriber voucher code:', voucherCodeError);
    }

    return {
      success: true,
      message: `Voucher redeemed! Pro access granted until ${expiresAt.toLocaleDateString()}.`,
      expiresAt: expiresAtStr,
    };
  } catch (err) {
    console.error('Error redeeming voucher:', err);
    return { success: false, message: 'An unexpected error occurred. Please try again.' };
  }
}

export async function getUserVoucherRedemptions(userId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('voucher_redemptions')
      .select('*, vouchers(*)')
      .eq('user_id', userId)
      .order('redeemed_at', { ascending: false });

    if (error) {
      console.error('Error fetching user voucher redemptions:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error fetching user voucher redemptions:', err);
    return [];
  }
}
