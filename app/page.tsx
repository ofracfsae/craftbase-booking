'use client';

import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, User, FileText, LogOut, Trash2, Edit2, Settings, Key, X } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface Booking {
  id: string;
  date: string;
  end_date?: string; // 追加: 終了日
  start_time: string;
  end_time: string;
  account_name: string;
  purpose: string;
}

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState('');
  const [accountName, setAccountName] = useState('');
  const [password, setPassword] = useState('');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [maxMonths, setMaxMonths] = useState<number>(1);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // 開始日と終了日のステート
  const [selectedDateStr, setSelectedDateStr] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDateStr, setEndDateStr] = useState<string>(new Date().toISOString().split('T')[0]);

  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2).toString().padStart(2, '0');
    const minute = i % 2 === 0 ? '00' : '30';
    return `${hour}:${minute}`;
  });

  const fetchData = async () => {
    const { data: bData } = await supabase.from('bookings').select('*').order('date', { ascending: true }).order('start_time', { ascending: true });
    if (bData) setBookings(bData);
    const { data: sData } = await supabase.from('settings').select('max_months_ahead').single();
    if (sData) setMaxMonths(sData.max_months_ahead);
  };

  useEffect(() => {
    if (isLoggedIn) fetchData();
  }, [isLoggedIn]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: `${accountName}@craftbase.local`,
      password: password,
    });
    if (error) {
      alert('ログインに失敗しました。');
    } else {
      setIsLoggedIn(true);
      setLoggedInUser(accountName);
    }
    setIsLoading(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      alert('パスワードの更新に失敗しました。');
    } else {
      alert('パスワードを更新しました。次回から新しいパスワードでログインしてください。');
      setShowPasswordForm(false);
      setNewPassword('');
    }
    setIsLoading(false);
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 【準備】新しい予約の開始・終了日時を正確に作る
    const newStart = new Date(`${selectedDateStr}T${startTime}:00`);
    const newEnd = new Date(`${endDateStr}T${endTime}:00`);
    
    // 【チェック1】終了日時が開始日時より前、または全く同じ場合は弾く
    if (newStart >= newEnd) {
      alert('終了日時は、開始日時よりも後の時間を設定してください。');
      return;
    }

    setIsLoading(true);

    // 【チェック2】すべての予約と照らし合わせて重複を防ぐ
    const isDuplicate = bookings.some((b) => {
      if (editingId && b.id === editingId) return false;

      const exEndDateStr = b.end_date || b.date;
      const exStart = new Date(`${b.date}T${b.start_time.slice(0, 5)}:00`);
      const exEnd = new Date(`${exEndDateStr}T${b.end_time.slice(0, 5)}:00`);
      
      return newStart < exEnd && newEnd > exStart;
    });

    if (isDuplicate) {
      alert('指定された期間は、すでに他の予約が入っているため予約できません。');
      setIsLoading(false);
      return;
    }

    if (editingId) {
      const { error } = await supabase.from('bookings').update({ date: selectedDateStr, end_date: endDateStr, start_time: startTime, end_time: endTime, purpose: purpose }).eq('id', editingId);
      if (error) alert('変更に失敗しました。');
      setEditingId(null);
    } else {
      const { error } = await supabase.from('bookings').insert([{ date: selectedDateStr, end_date: endDateStr, start_time: startTime, end_time: endTime, account_name: loggedInUser, purpose: purpose }]);
      if (error) alert('予約に失敗しました。');
    }

    setStartTime(''); setEndTime(''); setPurpose('');
    // 新規予約時は終了日を開始日にリセット
    setEndDateStr(selectedDateStr);
    fetchData();
    setIsLoading(false);
  };

  const handleDeleteBooking = async (id: string, account_name: string) => {
    if (window.confirm('この予約を削除しますか？')) {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) alert('削除に失敗しました。');
      else fetchData();
    }
  };

  const startEdit = (booking: Booking) => {
    setEditingId(booking.id);
    setSelectedDateStr(booking.date);
    setEndDateStr(booking.end_date || booking.date);
    setStartTime(booking.start_time.slice(0, 5));
    setEndTime(booking.end_time.slice(0, 5));
    setPurpose(booking.purpose);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarDays: (Date | null)[] = [
    ...Array.from({ length: firstDayOfMonth }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))
  ];

  const today = new Date();
  const maxDate = new Date();
  maxDate.setMonth(today.getMonth() + maxMonths);

  // 選択された日にかぶっているすべての予約を取得
  const selectedDayBookings = bookings.filter((b) => {
    const exEndDateStr = b.end_date || b.date;
    return selectedDateStr >= b.date && selectedDateStr <= exEndDateStr;
  });

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-gray-900">
        <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-center">Craft Base 予約システム</h1>
          <form className="space-y-4" onSubmit={handleLogin}>
            <input type="text" placeholder="アカウント名" required className="w-full rounded-lg border p-3" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            <input type="password" placeholder="パスワード" required className="w-full rounded-lg border p-3" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit" disabled={isLoading} className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white">{isLoading ? '処理中...' : 'ログイン'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-gray-900">
      <div className="mx-auto max-w-6xl space-y-6">
        
        <header className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Craft Base 会議室管理</h1>
              <p className="text-sm text-gray-500 mt-1">ログイン中: <span className="font-semibold text-slate-700">{loggedInUser}</span></p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setShowPasswordForm(!showPasswordForm)} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                <Key size={16} />パスワード変更
              </button>

              {loggedInUser === 'admin' && (
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border">
                  <Settings size={16} className="text-slate-500" />
                  <span className="text-xs font-medium">予約制限:</span>
                  <select value={maxMonths} onChange={(e) => supabase.from('settings').update({ max_months_ahead: Number(e.target.value) }).eq('id', 1).then(fetchData)} className="bg-white border rounded text-sm px-1">
                    {[1,2,3,6].map(m => <option key={m} value={m}>{m}ヶ月先</option>)}
                  </select>
                </div>
              )}
              <button onClick={() => setIsLoggedIn(false)} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50"><LogOut size={16} />ログアウト</button>
            </div>
          </div>

          {showPasswordForm && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-2">
              <form onSubmit={handlePasswordChange} className="flex flex-col sm:flex-row items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-600 mb-1">新しいパスワード（6文字以上）</label>
                  <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-lg border p-2 text-sm" placeholder="新しいパスワードを入力" />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={isLoading} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700">更新</button>
                  <button type="button" onClick={() => setShowPasswordForm(false)} className="bg-white border px-4 py-2 rounded-lg text-sm font-bold">閉じる</button>
                </div>
              </form>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2"><CalendarIcon size={20} className="text-blue-500" /> 空き状況カレンダー</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg">◀</button>
                  <span className="font-bold text-slate-700">{year}年 {month + 1}月</span>
                  <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg">▶</button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-2 text-center font-medium text-xs text-gray-400 mb-2">
                {['日', '月', '火', '水', '木', '金', '土'].map((d) => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((dateObj, idx) => {
                  if (!dateObj) return <div key={`empty-${idx}`} className="bg-gray-50/50 rounded-xl h-14" />;
                  const dateStr = dateObj.toISOString().split('T')[0];
                  
                  // その日が予約期間に含まれているかチェック
                  const hasBooking = bookings.some((b) => {
                    const exEndDateStr = b.end_date || b.date;
                    return dateStr >= b.date && dateStr <= exEndDateStr;
                  });
                  
                  const isSelected = selectedDateStr === dateStr;
                  const isPast = dateObj < new Date(today.setHours(0,0,0,0));
                  const isTooFar = dateObj > maxDate;

                  return (
                    <button
                      key={dateStr}
                      disabled={isPast || isTooFar}
                      onClick={() => {
                        setSelectedDateStr(dateStr);
                        // カレンダーをクリックしたら終了日も同じ日にリセット
                        setEndDateStr(dateStr); 
                        if (editingId) setEditingId(null);
                      }}
                      className={`h-14 rounded-xl flex flex-col items-center justify-center relative border transition-all ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-105 z-10' : isPast || isTooFar ? 'bg-gray-50 text-gray-300 border-transparent' : hasBooking ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-white border-gray-100'}`}
                    >
                      <span className="text-xs font-bold">{dateObj.getDate()}</span>
                      {hasBooking && !isSelected && <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
              <h3 className="text-md font-bold mb-4 text-slate-800">📅 {selectedDateStr} のスケジュール</h3>
              <div className="space-y-2">
                {selectedDayBookings.length === 0 ? (
                  <p className="text-sm text-emerald-600 font-medium bg-emerald-50 p-4 rounded-xl">空きあり</p>
                ) : (
                  selectedDayBookings.map((b) => {
                    // 日またぎの予約かどうか
                    const exEndDateStr = b.end_date || b.date;
                    const isMultiDay = b.date !== exEndDateStr;
                    
                    // 「初日」の画面を見ているかどうか（編集・削除の許可判定）
                    const isFirstDay = selectedDateStr === b.date;

                    return (
                      <div key={b.id} className="flex flex-col p-3 bg-slate-50 rounded-xl border border-slate-100 gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* 複数日にまたがる場合は日付も表示する工夫 */}
                            <span className="font-bold text-blue-600 text-sm">
                              {isMultiDay 
                                ? `${b.date.slice(5)} ${b.start_time.slice(0, 5)} 〜 ${exEndDateStr.slice(5)} ${b.end_time.slice(0, 5)}` 
                                : `${b.start_time.slice(0, 5)}-${b.end_time.slice(0, 5)}`}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${b.account_name === loggedInUser ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-500 border'}`}>{b.account_name}</span>
                            <span className="text-sm text-gray-600 truncate max-w-[150px]">{b.purpose}</span>
                          </div>
                          
                          {/* 【変更・削除ボタン】admin または 本人で、かつ「開始日」の画面を見ている時だけ表示 */}
                          {(loggedInUser === 'admin' || loggedInUser === b.account_name) && isFirstDay && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => startEdit(b)} className="p-2 text-slate-400 hover:text-blue-600"><Edit2 size={14} /></button>
                              <button onClick={() => handleDeleteBooking(b.id, b.account_name)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                            </div>
                          )}
                        </div>
                        
                        {/* 2日目以降の画面を見ている時の案内メッセージ */}
                        {!isFirstDay && (
                          <div className="text-[10px] text-amber-600 font-medium ml-2">
                            ※この予約の変更・削除は、開始日（{b.date}）のカレンダーから行ってください。
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 h-fit">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Clock size={20} className="text-blue-500" /> 予約フォーム</h2>
              <form className="space-y-4" onSubmit={handleBookingSubmit}>
                
                {/* 予約日のUIを変更（終了日を選べるように） */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1">開始日</label>
                    <div className="p-2 bg-slate-50 border rounded-lg text-sm font-medium text-slate-700 text-center">{selectedDateStr}</div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1">終了日</label>
                    <input type="date" required min={selectedDateStr} className="w-full rounded-lg border p-2 text-sm bg-white" value={endDateStr} onChange={(e) => setEndDateStr(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select required className="rounded-lg border p-2 text-sm bg-white" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
                    <option value="" disabled>開始時間</option>
                    {timeOptions.map(time => <option key={`start-${time}`} value={time}>{time}</option>)}
                  </select>
                  <select required className="rounded-lg border p-2 text-sm bg-white" value={endTime} onChange={(e) => setEndTime(e.target.value)}>
                    <option value="" disabled>終了時間</option>
                    {timeOptions.map(time => <option key={`end-${time}`} value={time}>{time}</option>)}
                  </select>
                </div>
                <input type="text" required className="w-full rounded-lg border p-2 text-sm" placeholder="目的（例：ミーティングなど）" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
                <button type="submit" disabled={isLoading} className={`w-full rounded-lg py-3 text-sm font-bold text-white ${editingId ? 'bg-amber-600' : 'bg-blue-600'}`}>{editingId ? '変更を確定' : '予約を確定'}</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}