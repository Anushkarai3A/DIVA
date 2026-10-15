import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { LogDeviationForm } from '../components/deviation/LogDeviationForm';
import { AiAssistantPanel } from '../components/ai/AiAssistantPanel';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { resetIntake } from '../features/deviation/deviationSlice';
import { createDeviationRequest } from '../features/deviation/deviationApi';
import {
  emptyFormValues,
  extractionToFormValues,
  type DeviationFormValues,
} from '../features/deviation/deviationTypes';
import { deviationResolver } from '../lib/validation';
import type { Status } from '../features/deviation/deviationSlice';

export function NewDeviation() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { status, aiResult, severity, input } = useAppSelector((state) => state.deviation);
  const form = useForm<DeviationFormValues>({
    resolver: deviationResolver,
    defaultValues: emptyFormValues(),
  });
  const prevStatus = useRef<Status>('idle');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'ready' && prevStatus.current !== 'ready' && aiResult) {
      form.reset(
        extractionToFormValues(
          aiResult.extraction.data,
          severity.final,
          input.sourceType,
          aiResult.impact?.impact_level ?? null,
        ),
      );
    }
    prevStatus.current = status;
  }, [status, aiResult, severity.final, input.sourceType, form]);

  useEffect(() => {
    return () => {
      dispatch(resetIntake());
    };
  }, [dispatch]);

  const save = form.handleSubmit(async (values) => {
    setSaving(true);
    const action = await dispatch(
      createDeviationRequest({ values, aiResult, rawText: input.text }),
    );
    setSaving(false);
    if (createDeviationRequest.fulfilled.match(action)) {
      navigate(`/deviations/${action.payload.id}`);
    }
  });

  const resetForm = () => {
    form.reset(emptyFormValues());
    dispatch(resetIntake());
  };

  return (
    <div
      className="grid items-start gap-5 lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)]"
      data-testid="review-stage"
    >
      <LogDeviationForm form={form} onSave={save} onReset={resetForm} saving={saving} />
      <AiAssistantPanel form={form} />
    </div>
  );
}
