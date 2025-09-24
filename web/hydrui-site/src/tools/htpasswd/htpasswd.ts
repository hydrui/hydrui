import { BCrypt } from "hydrui-util/src/bcrypt";

class User {
  public row = document.createElement("tr");
  private usernameColumn = document.createElement("td");
  private passwordColumn = document.createElement("td");
  private actionsColumn = document.createElement("td");
  private passwordPre = document.createElement("pre");
  private actionTest = document.createElement("button");
  private actionChangeUsername = document.createElement("button");
  private actionChangePassword = document.createElement("button");
  private actionDelete = document.createElement("button");

  constructor(
    public htpasswd: Htpasswd,
    public username: string,
    public hashedPassword: string,
  ) {
    this.passwordColumn.appendChild(this.passwordPre);
    this.actionTest.innerText = "Test";
    this.actionTest.addEventListener("click", (e) => this.test(e));
    this.actionTest.classList.add("button", "button-secondary", "button-small");
    this.actionsColumn.appendChild(this.actionTest);
    this.actionChangeUsername.innerText = "Change Username";
    this.actionChangeUsername.addEventListener("click", (e) =>
      this.changeUsername(e),
    );
    this.actionChangeUsername.classList.add(
      "button",
      "button-secondary",
      "button-small",
    );
    this.actionsColumn.appendChild(this.actionChangeUsername);
    this.actionChangePassword.addEventListener("click", (e) =>
      this.changePassword(e),
    );
    this.actionChangePassword.classList.add(
      "button",
      "button-secondary",
      "button-small",
    );
    this.actionChangePassword.innerText = "Change Password";
    this.actionsColumn.appendChild(this.actionChangePassword);
    this.actionDelete.addEventListener("click", (e) => this.remove(e));
    this.actionDelete.classList.add(
      "button",
      "button-secondary",
      "button-small",
    );
    this.actionDelete.innerText = "Delete";
    this.actionsColumn.appendChild(this.actionDelete);
    this.row.appendChild(this.usernameColumn);
    this.row.appendChild(this.passwordColumn);
    this.row.appendChild(this.actionsColumn);
    this.usernameColumn.innerText = username;
    this.passwordPre.innerText =
      hashedPassword.substring(0, 20) +
      (hashedPassword.length > 20 ? "..." : "");
  }

  test(event: Event) {
    event.preventDefault();
    if (!/^\$2[abxy]?\$(\d{2})\$(.{22})/.test(this.hashedPassword)) {
      alert("Sorry, only bcrypt-hashed passwords are supported at this time.");
      return;
    }
    const passwordInput = prompt(
      `Enter the password for user ${this.username}.`,
    );
    if (!passwordInput) {
      return;
    }
    if (BCrypt.verify(passwordInput, this.hashedPassword)) {
      alert("Correct.");
    } else {
      alert("Incorrect, or maybe the hash is wrong?");
    }
  }

  changeUsername(event: Event) {
    event.preventDefault();
    const usernameInput = prompt(
      `Enter a new username for user ${this.username}.`,
    );
    if (!usernameInput || usernameInput === this.username) {
      return;
    }
    try {
      this.htpasswd.checkUsername(usernameInput);
    } catch (e) {
      alert(`${e}`);
      return;
    }
    this.htpasswd.usernames.delete(this.username);
    this.username = usernameInput;
    this.htpasswd.usernames.add(this.username);
    this.usernameColumn.innerText = this.username;
    this.htpasswd.updateTextarea();
  }

  changePassword(event: Event) {
    event.preventDefault();
    const passwordInput = prompt(
      `Enter a new password for user ${this.username}.`,
    );
    if (passwordInput === null) {
      return;
    }
    this.hashedPassword = BCrypt.hash(passwordInput);
    this.passwordPre.innerText = this.hashedPassword.substring(0, 20) + "...";
    this.htpasswd.updateTextarea();
  }

  remove(event: Event) {
    event.preventDefault();
    this.htpasswd.usernames.delete(this.username);
    this.htpasswd.users = this.htpasswd.users.filter((user) => user !== this);
    this.htpasswd.usersTable.removeChild(this.row);
    this.htpasswd.updateTextarea();
  }

  htpasswdLine(): string {
    return `${this.username}:${this.hashedPassword}`;
  }
}

class Htpasswd {
  public users: User[] = [];
  public usernames = new Set<string>();
  form = document.getElementById("htpasswd-form")!;
  textarea = document.getElementById(
    "htpasswd-textarea",
  )! as HTMLTextAreaElement;
  usersTable = document.getElementById("users")!;
  usernameInput = document.getElementById("username")! as HTMLInputElement;
  passwordInput = document.getElementById("password")! as HTMLInputElement;
  selectFile = document.getElementById("select-file")! as HTMLInputElement;
  downloadButton = document.getElementById("download-button")!;
  clearButton = document.getElementById("clear-button")!;

  constructor() {
    this.form.addEventListener("submit", (e) => this.addUser(e));
    this.downloadButton.addEventListener("click", (e) => this.download(e));
    this.selectFile.addEventListener("change", (e) => this.load(e));
    this.clearButton.addEventListener("click", (e) => this.clear(e));
    this.updateTextarea();
    this.textarea.addEventListener("input", () => this.textareaInput());
  }

  addUser(event: Event) {
    event.preventDefault();
    const username = this.usernameInput.value;
    const password = this.passwordInput.value;
    try {
      this.checkUsername(username);
    } catch (e) {
      alert(`${e}`);
      return;
    }
    const hashedPassword = BCrypt.hash(password);
    const user = new User(this, username, hashedPassword);
    this.usersTable.appendChild(user.row);
    this.users.push(user);
    this.usernames.add(username);
    this.usernameInput.value = "";
    this.passwordInput.value = "";
    this.updateTextarea();
    this.usernameInput.focus();
  }

  download(event: Event) {
    event.preventDefault();
    const a = document.createElement("a");
    const text = this.htpasswdLines();
    const blob = new Blob([text], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.style = "display: none";
    a.href = url;
    a.download = "htpasswd.txt";
    a.click();
    window.URL.revokeObjectURL(url);
  }

  load(event: Event) {
    event.preventDefault();
    if (!this.selectFile.files) {
      return;
    }
    const file = this.selectFile.files.item(0);
    if (!file) {
      return;
    }
    file.text().then((data) => {
      this.loadFromString(data);
      this.textarea.value = data;
      this.selectFile.value = "";
    });
  }

  loadFromString(data: string) {
    this.usernames.clear();
    this.usersTable.innerHTML = "";
    this.users = data
      .trim()
      .replace("\r\n", "\n")
      .split("\n")
      .map((text) => text.trim())
      .filter((text) => text.length > 0)
      .map((line) => {
        const pos = line.indexOf(":");
        if (pos === -1) {
          return null;
        }
        return new User(this, line.substring(0, pos), line.substring(pos + 1));
      })
      .filter((user) => user !== null);
    for (const user of this.users) {
      this.usersTable.appendChild(user.row);
      this.usernames.add(user.username);
    }
  }

  clear(event: Event) {
    event.preventDefault();

    this.users = [];
    this.usernames.clear();
    this.usersTable.innerHTML = "";
    this.updateTextarea();
  }

  checkUsername(username: string) {
    if (username === "") {
      throw new Error("Username can not be blank.");
    }
    if (username.indexOf(":") !== -1) {
      throw new Error("Username can not contain colons.");
    }
    if (this.usernames.has(username)) {
      throw new Error("Username is already taken.");
    }
  }

  htpasswdLines(): string {
    return this.users.map((user) => user.htpasswdLine() + "\r\n").join("");
  }

  updateTextarea() {
    this.textarea.value = this.htpasswdLines();
  }

  textareaInput() {
    this.loadFromString(this.textarea.value);
  }
}

new Htpasswd();
