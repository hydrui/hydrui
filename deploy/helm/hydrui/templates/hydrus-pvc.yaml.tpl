{{- if and (eq .Values.mode "server-bundled") .Values.hydrus.persistence.enabled (not .Values.hydrus.persistence.existingClaim) }}
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{ include "hydrui.fullname" . }}-hydrus-db
  namespace: {{ include "hydrui.namespace" . }}
  labels:
    {{- include "hydrui.hydrus.labels" . | nindent 4 }}
  {{- with .Values.hydrus.persistence.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  accessModes:
    - {{ .Values.hydrus.persistence.accessMode }}
  {{- if .Values.hydrus.persistence.storageClass }}
  storageClassName: {{ .Values.hydrus.persistence.storageClass }}
  {{- end }}
  resources:
    requests:
      storage: {{ .Values.hydrus.persistence.size }}
{{- end }}
