from bson import ObjectId


def serialize_doc(doc):
    for key, value in doc.items():
        if isinstance(value, ObjectId):
            doc[key] = str(value)
    return doc