{{- if eq .Values.mode "server-bundled" }}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "hydrui.fullname" . }}-hydrus
  namespace: {{ include "hydrui.namespace" . }}
  labels:
    {{- include "hydrui.hydrus.labels" . | nindent 4 }}
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      {{- include "hydrui.hydrus.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/configmap: {{ include (print $.Template.BasePath "/hydrus-configmap.yaml.tpl") . | sha256sum }}
        checksum/secret: {{ include (print $.Template.BasePath "/secret.yaml.tpl") . | sha256sum }}
        {{- with .Values.hydrus.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      labels:
        {{- include "hydrui.hydrus.selectorLabels" . | nindent 8 }}
    spec:
      {{- with .Values.hydrui.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "hydrui.serviceAccountName" . }}
      {{- with .Values.hydrus.podSecurityContext }}
      securityContext:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      terminationGracePeriodSeconds: {{ .Values.hydrus.terminationGracePeriodSeconds }}
      containers:
        - name: hydrus
          {{- with .Values.hydrus.securityContext }}
          securityContext:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          image: {{ include "hydrui.hydrus.image" . }}
          imagePullPolicy: {{ .Values.hydrus.image.pullPolicy }}
          command: ["/bin/sh", "/.init-hydrus-api.sh"]
          ports:
            - name: novnc
              containerPort: 5800
              protocol: TCP
            - name: vnc
              containerPort: 5900
              protocol: TCP
            - name: api
              containerPort: 45869
              protocol: TCP
          env:
            - name: HYDRUI_HYDRUS_API_KEY
              valueFrom:
                secretKeyRef:
                  name: {{ include "hydrui.hydrusApiKeySecretName" . }}
                  key: {{ include "hydrui.hydrusApiKeySecretKey" . }}
            - name: HYDRUI_SECRET
              valueFrom:
                secretKeyRef:
                  name: {{ include "hydrui.sessionSecretName" . }}
                  key: {{ include "hydrui.sessionSecretKey" . }}
            {{- with .Values.hydrus.extraEnv }}
            {{- toYaml . | nindent 12 }}
            {{- end }}
          livenessProbe:
            httpGet:
              path: /api_version
              port: api
              scheme: HTTP
            initialDelaySeconds: {{ .Values.hydrus.livenessProbe.initialDelaySeconds }}
            periodSeconds: {{ .Values.hydrus.livenessProbe.periodSeconds }}
            timeoutSeconds: {{ .Values.hydrus.livenessProbe.timeoutSeconds }}
            successThreshold: {{ .Values.hydrus.livenessProbe.successThreshold }}
            failureThreshold: {{ .Values.hydrus.livenessProbe.failureThreshold }}
          readinessProbe:
            httpGet:
              path: /api_version
              port: api
              scheme: HTTP
            initialDelaySeconds: {{ .Values.hydrus.readinessProbe.initialDelaySeconds }}
            periodSeconds: {{ .Values.hydrus.readinessProbe.periodSeconds }}
            timeoutSeconds: {{ .Values.hydrus.readinessProbe.timeoutSeconds }}
            successThreshold: {{ .Values.hydrus.readinessProbe.successThreshold }}
            failureThreshold: {{ .Values.hydrus.readinessProbe.failureThreshold }}
          {{- with .Values.hydrus.resources }}
          resources:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          volumeMounts:
            - name: init-script
              mountPath: /.init-hydrus-api.sh
              subPath: init-hydrus-api.sh
              readOnly: true
            - name: hydrus-db
              mountPath: /opt/hydrus/db
            {{- if .Values.hydrus.tmpfs.enabled }}
            - name: tmp
              mountPath: /tmp
            {{- end }}
            {{- with .Values.hydrus.extraVolumeMounts }}
            {{- toYaml . | nindent 12 }}
            {{- end }}
      {{- with .Values.hydrus.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.hydrus.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.hydrus.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      volumes:
        - name: init-script
          configMap:
            name: {{ include "hydrui.fullname" . }}-hydrus-init
            defaultMode: 0755
        - name: hydrus-db
          {{- if .Values.hydrus.persistence.existingClaim }}
          persistentVolumeClaim:
            claimName: {{ .Values.hydrus.persistence.existingClaim }}
          {{- else if .Values.hydrus.persistence.enabled }}
          persistentVolumeClaim:
            claimName: {{ include "hydrui.fullname" . }}-hydrus-db
          {{- else }}
          emptyDir: {}
          {{- end }}
        {{- if .Values.hydrus.tmpfs.enabled }}
        - name: tmp
          emptyDir:
            medium: Memory
            {{- if .Values.hydrus.tmpfs.sizeLimit }}
            sizeLimit: {{ .Values.hydrus.tmpfs.sizeLimit }}
            {{- end }}
        {{- end }}
        {{- with .Values.hydrus.extraVolumes }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
{{- end }}
