import fs from "fs";
export const createFile = (filename, content) => {
  const document = fs.writeFileSync(filename, content, function (err) {
    if (err) return err;
    console.log("file is created successfully");
  });
  return document;
};

export const deleteFile = (filename) => {
  fs.rmSync(filename, {
    force: true,
  });
};
