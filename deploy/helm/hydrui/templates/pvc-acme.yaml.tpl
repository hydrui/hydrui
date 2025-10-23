{{- if and (or (eq .Values.mode "server-bundled") (eq .Values.mode "server-external")) .Values.serverMode.acme.enabled .Values.serverMode.acme.persistence.enabled (not .Values.serverMode.acme.persistence.existingClaim) }}
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{ include "hydrui.fullname" . }}-acme
  namespace: {{ include "hydrui.namespace" . }}
  labels:
    {{- include "hydrui.labels" . | nindent 4 }}
spec:
  accessModes:
    - {{ .Values.serverMode.acme.persistence.accessMode }}
  {{- if .Values.serverMode.acme.persistence.storageClass }}
  storageClassName: {{ .Values.serverMode.acme.persistence.storageClass }}
  {{- end }}
  resources:
    requests:
      storage: {{ .Values.serverMode.acme.persistence.size }}
{{- end }}
