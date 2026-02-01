import {
  Button,
  Dialog,
  BasicInput,
  Popover,
  Text,
  Tooltip,
  DialogTrigger,
  Form,
  Input,
} from "@/components/AriaComponents";
import type { Server } from "@/db/schema";
import { createServerMutation, deleteServerMutation, updateServerMutation } from "@/queries";
import { useMutation } from "@lib/goat-query/react";
import { useState, useRef, useEffect } from "react";
import { useServerContext } from "./ServerContext";
import { z } from "zod";
import { useFilter } from "react-aria";

// ─────────────────────────────────────────────────────────────────────────────
// Server Selector Component
// ─────────────────────────────────────────────────────────────────────────────

interface ServerSelectorProps {
  triggerButton: React.ReactElement;
}

export function ServerSelector({ triggerButton }: ServerSelectorProps) {
  const { servers, selectedIndex, selectServer } = useServerContext();
  const filter = useFilter({
    sensitivity: "base",
    ignorePunctuation: true,
  });

  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [serverToDelete, setServerToDelete] = useState<Server | null>(null);

  const form = Form.useForm({
    schema: z.object({
      query: z.string().trim().toLowerCase(),
    }),
    defaultValues: {
      query: "",
    },
  });

  return (
    <>
      <DialogTrigger>
        {triggerButton}

        <Popover size="small" rounded="large" placement="bottom start">
          {({ close }) => (
            <>
              <Popover.Header>
                <Input
                  form={form}
                  name="query"
                  placeholder="Search servers..."
                  aria-label="Search servers"
                  rounded="large"
                />
              </Popover.Header>

              <Form.FieldValue name="query" form={form}>
                {(searchQuery) => {
                  const filteredServers = servers.filter(
                    (server: Server) =>
                      filter.contains(server.name, searchQuery) ||
                      filter.contains(server.ip, searchQuery) ||
                      filter.contains(server.region, searchQuery),
                  );

                  return (
                    <>
                      {filteredServers.length === 0 ? (
                        <div className="p-4 text-center">
                          <Text color="muted">No servers found</Text>
                        </div>
                      ) : (
                        filteredServers.map((server: Server) => {
                          const originalIndex = servers.findIndex(
                            (s: Server) => s.id === server.id,
                          );
                          const isSelected = originalIndex === selectedIndex;
                          const isEditing = editingServerId === server.id;

                          return (
                            <ServerListItem
                              key={server.id}
                              server={server}
                              isSelected={isSelected}
                              isEditing={isEditing}
                              editingName={editingName}
                              onSelect={() => {
                                selectServer(originalIndex);
                                close();
                              }}
                              onStartEdit={() => {
                                setEditingServerId(server.id);
                                setEditingName(server.name);
                              }}
                              onEditChange={setEditingName}
                              onEditSave={() => setEditingServerId(null)}
                              onEditCancel={() => {
                                setEditingServerId(null);
                                setEditingName("");
                              }}
                              onDelete={() => setServerToDelete(server)}
                            />
                          );
                        })
                      )}
                    </>
                  );
                }}
              </Form.FieldValue>

              <Popover.Footer>
                <DialogTrigger>
                  <Button variant="outline" size="small" fullWidth>
                    + Add Server
                  </Button>

                  <AddServerDialog />
                </DialogTrigger>
              </Popover.Footer>
            </>
          )}
        </Popover>
      </DialogTrigger>

      {/* Delete Confirmation Dialog */}
      {serverToDelete && (
        <DeleteServerDialog server={serverToDelete} onClose={() => setServerToDelete(null)} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Server List Item
// ─────────────────────────────────────────────────────────────────────────────

interface ServerListItemProps {
  server: Server;
  isSelected: boolean;
  isEditing: boolean;
  editingName: string;
  onSelect: () => void;
  onStartEdit: () => void;
  onEditChange: (value: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onDelete: () => void;
}

function getStatusColor(status: Server["status"]): string {
  switch (status) {
    case "healthy":
      return "bg-green-500";
    case "warning":
      return "bg-yellow-500";
    case "critical":
      return "bg-red-500";
    case "offline":
      return "bg-gray-400";
    default:
      return "bg-gray-400";
  }
}

function ServerListItem({
  server,
  isSelected,
  isEditing,
  editingName,
  onSelect,
  onStartEdit,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDelete,
}: ServerListItemProps) {
  const updateServer = useMutation({ mutation: updateServerMutation });
  const inputRef = useRef<HTMLInputElement>(null);
  const statusColor = getStatusColor(server.status);

  const handleSave = async () => {
    if (editingName.trim() && editingName !== server.name) {
      await updateServer.mutate({ id: server.id, name: editingName.trim() });
    }
    onEditSave();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onEditCancel();
    }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors group ${isSelected ? "bg-gray-100" : ""}`}
      onClick={!isEditing ? onSelect : undefined}
    >
      {/* Status Indicator */}
      <Tooltip placement="left">
        <div className={`w-3 h-3 rounded-full shrink-0 ${statusColor}`} />
        <Text variant="body-sm">Status: {server.status}</Text>
      </Tooltip>

      {/* Server Name / Edit Input */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <BasicInput
            ref={inputRef}
            value={editingName}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            rounded="medium"
            size="small"
          />
        ) : (
          <Text truncate="1" weight={isSelected ? "semibold" : "normal"}>
            {server.name}
          </Text>
        )}
      </div>

      {/* Region Tag */}
      <Text variant="body-sm" color="muted">
        {server.region}
      </Text>

      {/* Actions - Always visible */}
      {!isEditing && (
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Tooltip placement="top">
            <Button
              variant="ghost"
              size="small"
              className="p-1 min-w-0 h-auto"
              onPress={() => onStartEdit()}
              aria-label="Rename server"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
            </Button>
            <Text variant="body-sm">Rename</Text>
          </Tooltip>

          <Tooltip placement="top">
            <Button
              variant="ghost"
              size="small"
              className="p-1 min-w-0 h-auto text-red-500 hover:text-red-600"
              onPress={() => onDelete()}
              aria-label="Delete server"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </Button>
            <Text variant="body-sm">Delete</Text>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Server Dialog
// ─────────────────────────────────────────────────────────────────────────────

const addServerSchema = z.object({
  name: z.string().min(1, "Server name is required"),
  ip: z.ipv4().min(1, "IP address is required"),
  region: z.enum(["us-east", "us-west", "eu-west", "eu-central", "asia-pacific"]),
});

function AddServerDialog() {
  const createServer = useMutation({ mutation: createServerMutation });

  const form = Form.useForm({
    schema: addServerSchema,
    method: "dialog",
    defaultValues: {
      name: "",
      ip: "",
      region: "us-east",
    },
    onSubmit: (values) =>
      createServer.mutate({
        name: values.name.trim(),
        ip: values.ip.trim(),
        region: values.region,
        status: "healthy",
        tags: [],
      }),
  });

  return (
    <Dialog type="modal" size="medium" title="Add New Server">
      <Form form={form} gap="medium" className="p-4">
        <Input
          form={form}
          name="name"
          placeholder="e.g., Production API Server"
          rounded="large"
          label="Server Name"
        />
        <Input
          form={form}
          name="ip"
          placeholder="e.g., 192.168.1.100"
          rounded="large"
          label="IP Address"
        />

        <Form.Field name="region" label="Region">
          {(fieldProps) => (
            <select
              {...fieldProps}
              className="p-2 rounded-lg border border-border bg-background text-sm w-full"
            >
              <option value="us-east">US East</option>
              <option value="us-west">US West</option>
              <option value="eu-west">EU West</option>
              <option value="eu-central">EU Central</option>
              <option value="asia-pacific">Asia Pacific</option>
            </select>
          )}
        </Form.Field>

        <div className="flex gap-2 justify-end mt-4">
          <Dialog.Close variant="ghost">Cancel</Dialog.Close>
          <Form.Submit variant="primary">
            {({ isSubmitting }) => (isSubmitting ? "Adding..." : "Add Server")}
          </Form.Submit>
        </div>

        <Form.FormError />
      </Form>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete Server Dialog
// ─────────────────────────────────────────────────────────────────────────────

interface DeleteServerDialogProps {
  server: Server;
  onClose: () => void;
}

function DeleteServerDialog({ server, onClose }: DeleteServerDialogProps) {
  const deleteServer = useMutation({ mutation: deleteServerMutation });
  const { selectedIndex, selectServer, servers } = useServerContext();

  const handleDelete = async () => {
    await deleteServer.mutate(server.id);

    // If deleting currently selected server, select another one
    const serverIndex = servers.findIndex((s: Server) => s.id === server.id);
    if (serverIndex === selectedIndex && servers.length > 1) {
      const newIndex = serverIndex === 0 ? 1 : 0;
      selectServer(newIndex);
    }

    onClose();
  };

  return (
    <Dialog type="modal" size="small" title="Delete Server">
      <Form schema={z.object({})} onSubmit={handleDelete} className="p-4" gap="medium">
        <Text>
          Are you sure you want to delete <strong>{server.name}</strong>?
        </Text>
        <Text variant="body-sm" color="muted">
          This action cannot be undone. All metrics and logs for this server will be removed.
        </Text>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onPress={onClose}>
            Cancel
          </Button>
          <Form.Submit variant="delete" isDisabled={deleteServer.isPending}>
            {deleteServer.isPending ? "Deleting..." : "Delete Server"}
          </Form.Submit>
        </div>
        <Form.FormError
          form={
            {
              formState: {
                errors: {
                  root: {
                    submit: deleteServer.error
                      ? { message: deleteServer.error.message }
                      : undefined,
                  },
                },
              },
            } as any
          }
        />
      </Form>
    </Dialog>
  );
}
