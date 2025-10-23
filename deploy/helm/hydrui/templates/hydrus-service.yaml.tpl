{{- if eq .Values.mode "server-bundled" }}
apiVersion: v1
kind: Service
metadata:
  name: {{ include "hydrui.fullname" . }}-hydrus
  namespace: {{ include "hydrui.namespace" . }}
  labels:
    {{- include "hydrui.hydrus.labels" . | nindent 4 }}
  {{- with .Values.hydrus.service.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  type: {{ .Values.hydrus.service.type }}
  ports:
    - port: {{ .Values.hydrus.service.novncPort }}
      targetPort: novnc
      protocol: TCP
      name: novnc
    - port: {{ .Values.hydrus.service.vncPort }}
      targetPort: vnc
      protocol: TCP
      name: vnc
    - port: {{ .Values.hydrus.service.apiPort }}
      targetPort: api
      protocol: TCP
      name: api
  selector:
    {{- include "hydrui.hydrus.selectorLabels" . | nindent 4 }}
{{- end }}
