import { useState, use } from "react";
import { createRoute } from "@tanstack/react-router";
import Root from "./__root";
import { useQuery, useMutation } from "@lib/goat-query/react";
import {
  alertsQuery,
  createAlertMutation,
  updateAlertMutation,
  deleteAlertMutation,
  toggleAlertMutation,
} from "@/queries";
import { AlertRuleBuilder } from "./Alerts/index";
import type { Alert } from "@/db/schema";
import { Button, Text } from "@/components/AriaComponents";

function AlertsPage() {
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { promise } = useQuery({ query: alertsQuery, params: undefined });
  const alerts = use(promise) ?? [];

  const createAlert = useMutation({ mutation: createAlertMutation });
  const updateAlert = useMutation({ mutation: updateAlertMutation });
  const deleteAlert = useMutation({ mutation: deleteAlertMutation });
  const toggleAlert = useMutation({ mutation: toggleAlertMutation });

  const handleCreate = async (values: { name: string; metric: string; operator: string; threshold: number; duration: number }) => {
    await createAlert.mutate({
      name: values.name,
      metric: values.metric as Alert["metric"],
      operator: values.operator as Alert["operator"],
      threshold: values.threshold,
      duration: values.duration,
      enabled: true,
      serverId: null,
    });
    setIsCreating(false);
  };

  const handleEdit = async (values: { name: string; metric: string; operator: string; threshold: number; duration: number }) => {
    if (!editingAlert) return;
    await updateAlert.mutate({
      id: editingAlert.id,
      name: values.name,
      metric: values.metric as Alert["metric"],
      operator: values.operator as Alert["operator"],
      threshold: values.threshold,
      duration: values.duration,
      enabled: editingAlert.enabled,
      serverId: editingAlert.serverId,
    });
    setEditingAlert(null);
  };

  const handleToggle = async (alert: Alert) => {
    await toggleAlert.mutate({ id: alert.id, enabled: !alert.enabled });
  };

  const handleDelete = async (alertId: string) => {
    if (confirm("Are you sure you want to delete this alert?")) {
      await deleteAlert.mutate(alertId);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingAlert(null);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Text variant="h1">Alert Rules</Text>
          <Text variant="body-sm" color="muted">
            Configure alerts to get notified when metrics exceed thresholds
          </Text>
        </div>
        <Button variant="primary" size="medium" onPress={() => setIsCreating(true)}>
          Create Alert Rule
        </Button>
      </div>

      {(isCreating || editingAlert) && (
        <AlertRuleBuilder
          alert={editingAlert ?? undefined}
          onSubmit={editingAlert ? handleEdit : handleCreate}
          onCancel={handleCancel}
        />
      )}

      <AlertsList
        alerts={alerts}
        onEdit={setEditingAlert}
        onToggle={handleToggle}
        onDelete={handleDelete}
      />
    </div>
  );
}

function AlertsList({ alerts, onEdit, onToggle, onDelete }: {
  alerts: Alert[];
  onEdit: (alert: Alert) => void;
  onToggle: (alert: Alert) => void;
  onDelete: (alertId: string) => void;
}) {
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

export default createRoute({
  getParentRoute: () => Root,
  path: "/alerts",
  component: AlertsPage,
});
