import { useState } from 'react';
import { useAnalyzeMessage, useCreateSession, getListSessionsQueryKey, getGetDashboardStatsQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Save, RotateCcw, CheckCircle2, ArrowLeft, Bot } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';

export default function ChatPage() {
  const [message, setMessage] = useState('');
  const [extractedData, setExtractedData] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const analyzeMutation = useAnalyzeMessage();
  const createMutation = useCreateSession();

  const handleAnalyze = () => {
    if (!message.trim()) {
      toast({
        title: 'تنبيه',
        description: 'يرجى إدخال نص الرسالة أولاً',
        variant: 'destructive',
      });
      return;
    }

    analyzeMutation.mutate(
      { data: { message } },
      {
        onSuccess: (data: any) => {
          setExtractedData(data);
          setFormData({
            caseNumber: data.case_number || '',
            plaintiff: data.plaintiff || '',
            defendant: data.defendant || '',
            court: data.court || '',
            courtCircuit: data.court_circuit || '',
            caseSubject: data.case_subject || '',
            sessionType: data.session_type || '',
            sessionDateHijri: data.session_date_hijri || '',
            sessionTime: data.session_time || '',
            notes: data.notes || '',
          });
          toast({
            title: 'تم التحليل بنجاح',
            description: 'تم استخراج البيانات. راجعها وعدّلها قبل الحفظ.',
          });
        },
        onError: (error: any) => {
          toast({
            title: 'فشل التحليل',
            description: error?.message || 'تعذّر تحليل الرسالة، حاول مرة أخرى',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleSave = () => {
    createMutation.mutate(
      { data: formData },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          toast({
            title: 'تم الحفظ',
            description: 'تم حفظ جلسة المحكمة بنجاح',
          });
          setMessage('');
          setExtractedData(null);
          setFormData({});
          setLocation('/sessions');
        },
        onError: (error: any) => {
          toast({
            title: 'فشل الحفظ',
            description: error?.message || 'تعذّر حفظ الجلسة',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleReset = () => {
    setMessage('');
    setExtractedData(null);
    setFormData({});
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const fields = [
    { key: 'caseNumber', label: 'رقم القضية', dir: 'ltr' as const, mono: true },
    { key: 'court', label: 'المحكمة', dir: 'rtl' as const },
    { key: 'plaintiff', label: 'المدّعي', dir: 'rtl' as const },
    { key: 'defendant', label: 'المدّعى عليه', dir: 'rtl' as const },
    { key: 'courtCircuit', label: 'الدائرة القضائية', dir: 'rtl' as const },
    { key: 'caseSubject', label: 'موضوع القضية', dir: 'rtl' as const },
    { key: 'sessionType', label: 'نوع الجلسة', dir: 'rtl' as const },
    { key: 'sessionDateHijri', label: 'تاريخ الجلسة (ميلادي / هجري)', dir: 'ltr' as const, mono: true },
    { key: 'sessionTime', label: 'وقت الجلسة', dir: 'auto' as const, mono: true },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="fade-in-up">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-6 rounded-full bg-primary" />
          <h1 className="text-2xl font-bold tracking-tight">تحليل رسالة المحكمة</h1>
        </div>
        <p className="text-muted-foreground text-sm mr-3">
          الصق نص رسالة الجلسة لاستخراج البيانات تلقائياً بالذكاء الاصطناعي
        </p>
      </div>

      {/* Message Input Card */}
      <div className="fade-in-up fade-in-up-delay-1 rounded-xl border border-border bg-card overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">نص الرسالة</p>
            <p className="text-xs text-muted-foreground">الصق نص إشعار الجلسة الواردة من المحكمة</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <Textarea
            placeholder="الصق نص رسالة المحكمة هنا..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            disabled={analyzeMutation.isPending}
            className="text-base resize-none leading-relaxed border-border/50 focus:border-primary/50 bg-background/50"
            dir="auto"
            data-testid="textarea-message"
          />
          <div className="flex gap-2">
            <Button
              onClick={handleAnalyze}
              disabled={analyzeMutation.isPending || !message.trim()}
              className="gap-2 shadow-sm"
              data-testid="button-analyze"
            >
              <Sparkles className="w-4 h-4" />
              {analyzeMutation.isPending ? 'جارٍ التحليل...' : 'تحليل بالذكاء الاصطناعي'}
            </Button>
            {extractedData && (
              <Button
                onClick={handleReset}
                variant="outline"
                className="gap-2"
                data-testid="button-reset"
              >
                <RotateCcw className="w-4 h-4" />
                إعادة تعيين
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Success Alert */}
      {extractedData && (
        <div className="fade-in-up rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">تم استخراج البيانات بنجاح</p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80 mt-0.5">
              راجع الحقول أدناه وعدّلها إن لزم، ثم اضغط زر الحفظ
            </p>
          </div>
        </div>
      )}

      {/* Extracted Data Form */}
      {extractedData && (
        <div className="fade-in-up rounded-xl border border-primary/20 bg-card overflow-hidden shadow-sm">
          {/* Form Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-primary/3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <ArrowLeft className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">البيانات المستخرجة</p>
              <p className="text-xs text-muted-foreground">راجع الحقول وعدّلها إن لزم</p>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={f.key} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {f.label}
                  </Label>
                  <Input
                    id={f.key}
                    value={formData[f.key] || ''}
                    onChange={(e) => updateField(f.key, e.target.value)}
                    className={`${f.mono ? 'font-mono' : ''} h-9 text-sm`}
                    dir={f.dir}
                    data-testid={`input-${f.key}`}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                ملاحظات
              </Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                rows={3}
                dir="auto"
                className="resize-none text-sm"
                data-testid="textarea-notes"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={createMutation.isPending}
              size="lg"
              className="w-full gap-2 text-base font-bold h-12 shadow-sm"
              data-testid="button-save"
            >
              <Save className="w-5 h-5" />
              {createMutation.isPending ? 'جارٍ الحفظ في Google Sheets...' : 'حفظ الجلسة في Google Sheets'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
