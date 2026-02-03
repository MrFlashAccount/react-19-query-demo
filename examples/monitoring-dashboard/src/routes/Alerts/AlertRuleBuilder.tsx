import { useState } from "react";
import { Button, Text, Dialog, DialogTrigger, Form, Input } from "@/components/AriaComponents";
import type { Alert, AlertMetric, AlertOperator } from "@/db/schema";
import { z } from "zod";

const ALERT_METRICS: AlertMetric[] = ["cpu", "memory", "networkIn", "networkOut"];
const ALERT_OPERATORS: AlertOperator[] = [">", "<", ">=", "<="];

const alertRuleSchema = z.object({
  name: z.string().min(1).max(100),
  metric: z.enum(["cpu", "memory", "networkIn", "networkOut"]),
  operator: z.enum([">", "<", ">=", "<="]),
  threshold: z.number().min(0).max(100),
  duration: z.number().positive(),
});

type AlertRuleValues = z.infer<typeof alertRuleSchema>;

interface AlertRuleBuilderProps {
  alert?: Alert;
  onSubmit: (values: AlertRuleValues) => void;
  onCancel: () => void;
}

export function AlertRuleBuilder({ alert, onSubmit, onCancel }: AlertRuleBuilderProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(true);

  const handleSubmit = async (values: AlertRuleValues) => {
    await onSubmit(values);
    setIsDialogOpen(false);
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
    onCancel();
  };

  const defaultValues = alert
    ? {
        name: alert.name,
        metric: alert.metric,
        operator: alert.operator,
        threshold: alert.threshold,
        duration: alert.duration,
      }
    : {
        name: "",
        metric: "cpu" as const,
        operator: ">" as const,
        threshold: 80,
        duration: 300,
      };

  return (
    <DialogTrigger isOpen={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <Button variant="outline" size="small">
        {alert ? "Edit Alert" : "Create Alert"}
      </Button>

      <Dialog title={alert ? "Edit Alert Rule" : "Create Alert Rule"}>
        <Form schema={alertRuleSchema} defaultValues={defaultValues} onSubmit={handleSubmit}>
          {(form) => (
            <div className="flex flex-col gap-4 p-4">
              <Form.Field name="name" label="Alert Name">
                {(fieldProps) => (
                  <Input
                    form={form}
                    name="name"
                    placeholder="High CPU Usage"
                    rounded="medium"
                    {...fieldProps}
                  />
                )}
              </Form.Field>

              <div className="grid grid-cols-3 gap-3">
                <Form.Field name="metric" label="Metric">
                  {(fieldProps) => (
                    <select
                      name="metric"
                      {...fieldProps}
                      className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    >
                      {ALERT_METRICS.map((metric) => (
                        <option key={metric} value={metric}>
                          {metric.charAt(0).toUpperCase() + metric.slice(1)}
                        </option>
                      ))}
                    </select>
                  )}
                </Form.Field>

                <Form.Field name="operator" label="Condition">
                  {(fieldProps) => (
                    <select
                      name="operator"
                      {...fieldProps}
                      className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    >
                      {ALERT_OPERATORS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                  )}
                </Form.Field>

                <Form.Field name="threshold" label="Threshold (%)">
                  {(fieldProps) => (
                    <Input
                      form={form}
                      name="threshold"
                      type="number"
                      min={0}
                      max={100}
                      rounded="medium"
                      {...fieldProps}
                    />
                  )}
                </Form.Field>
              </div>

              <Form.Field name="duration" label="Duration (seconds)">
                {(fieldProps) => (
                  <Input
                    form={form}
                    name="duration"
                    type="number"
                    min={1}
                    placeholder="300"
                    rounded="medium"
                    {...fieldProps}
                  />
                )}
              </Form.Field>

              <Text variant="body-sm" color="muted">
                Alert will trigger when metric exceeds threshold for the specified duration.
              </Text>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onPress={handleCancel}>
                  Cancel
                </Button>
                <Form.Submit variant="primary">
                  {alert ? "Save Changes" : "Create Alert"}
                </Form.Submit>
              </div>
              <Form.FormError />
            </div>
          )}
        </Form>
      </Dialog>
    </DialogTrigger>
  );
}

interface AlertsListProps {
  alerts: Alert[];
  onEdit: (alert: Alert) => void;
  onToggle: (alert: Alert) => void;
  onDelete: (alertId: string) => void;
}

export function AlertsList({ alerts, onEdit, onToggle, onDelete }: AlertsListProps) {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Text variant="body" color="muted">
          No alert rules configured
        </Text>
        <Text variant="body-sm" color="muted">
          Create an alert to get notified when metrics exceed thresholds
        </Text>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center justify-between p-3 rounded-lg border ${
            alert.enabled
              ? "bg-background border-border"
              : "bg-muted/30 border-border/50 opacity-60"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-2 h-2 rounded-full ${
                alert.enabled
                  ? alert.metric === "cpu" || alert.metric === "memory"
                    ? "bg-warning"
                    : "bg-info"
                  : "bg-muted"
              }`}
            />
            <div>
              <Text variant="body-sm" weight="medium">
                {alert.name}
              </Text>
              <Text variant="caption" color="muted">
                {alert.metric} {alert.operator} {alert.threshold}% for {alert.duration}s
                {alert.serverId ? "" : " (all servers)"}
              </Text>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="xsmall" onPress={() => onToggle(alert)}>
              {alert.enabled ? "Disable" : "Enable"}
            </Button>
            <Button variant="ghost" size="xsmall" onPress={() => onEdit(alert)}>
              Edit
            </Button>
            <Button variant="ghost" size="xsmall" onPress={() => onDelete(alert.id)}>
              Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
